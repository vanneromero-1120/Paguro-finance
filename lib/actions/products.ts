// ============================================================================
// Paguro Finance - Product Server Actions
// Multi-company isolated, RLS-enforced, stock-aware, audit-logged
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  Product,
  ProductWithStock,
  CreateProductInput,
  UpdateProductInput,
  TaxRate,
  Supplier,
} from '@/types/database';
import { roundHalfUp } from '@/lib/finance/calculations';
import { calculateInventoryValuation } from '@/lib/finance/inventory';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];

/**
 * Retrieves all products for the user's active authorized company,
 * enriched with live calculated stock and valuation.
 */
export async function getProductsAction(
  search?: string,
  category?: string,
  statusFilter?: string,
  productType?: string
): Promise<ActionResponse<ProductWithStock[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    // 1. Fetch products belonging to the active company
    let query = supabase
      .from('products')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (productType && productType !== 'all') {
      query = query.eq('product_type', productType);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%,category.ilike.%${term}%,barcode.ilike.%${term}%`);
    }

    query = query.order('name', { ascending: true });

    const { data: rawProducts, error: prodError } = await query;
    if (prodError) {
      console.error('[getProductsAction] Error fetching products:', prodError);
      return { success: false, error: prodError.message, data: [] };
    }

    const products = (rawProducts as Product[]) || [];
    if (products.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Fetch tax rates for mapping
    const { data: taxRates } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('company_id', session.activeCompanyId);
    const taxRateMap = new Map<string, TaxRate>();
    (taxRates || []).forEach((tr: TaxRate) => taxRateMap.set(tr.id, tr));

    // 3. Fetch suppliers for mapping
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, legal_name, tax_id')
      .eq('company_id', session.activeCompanyId);
    const supplierMap = new Map<string, any>();
    (suppliers || []).forEach((s: any) => supplierMap.set(s.id, s));

    // 4. Batch fetch inventory movements to compute authoritative current stock
    const productIds = products.map((p) => p.id);
    const { data: movements, error: movError } = await supabase
      .from('inventory_movements')
      .select('product_id, quantity_delta')
      .eq('company_id', session.activeCompanyId)
      .in('product_id', productIds);

    const stockMap: Record<string, number> = {};
    if (!movError && movements) {
      for (const m of movements) {
        stockMap[m.product_id] = (stockMap[m.product_id] || 0) + Number(m.quantity_delta || 0);
      }
    }

    // 5. Build ProductWithStock objects with decimal-safe calculations
    const enriched: ProductWithStock[] = products.map((p) => {
      const currentStock = p.is_inventory_item ? roundHalfUp(stockMap[p.id] || 0, 4) : 0;
      const unitCost = Number(p.cost || 0);
      const inventoryValue = p.is_inventory_item ? calculateInventoryValuation(currentStock, unitCost) : 0;

      return {
        ...p,
        cost: unitCost,
        sale_price: Number(p.sale_price || 0),
        stock_minimum: Number(p.stock_minimum || 0),
        current_stock: currentStock,
        inventory_value: inventoryValue,
        tax_rate: taxRateMap.get(p.tax_rate_id) || null,
        supplier: p.supplier_id ? supplierMap.get(p.supplier_id) || null : null,
      };
    });

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getProductsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener productos.', data: [] };
  }
}

/**
 * Creates a new product for the user's active authorized company with full validation and audit logging.
 */
export async function createProductAction(
  input: CreateProductInput
): Promise<ActionResponse<Product>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador u Operaciones.',
    };
  }

  const sku = input.sku?.trim().toUpperCase();
  if (!sku) {
    return { success: false, error: 'El código SKU es obligatorio.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { success: false, error: 'El nombre del producto es obligatorio.' };
  }

  const cost = Math.max(0, Number(input.cost) || 0);
  const salePrice = Math.max(0, Number(input.sale_price) || 0);
  const stockMinimum = Math.max(0, Number(input.stock_minimum) || 0);

  if (!input.tax_rate_id) {
    return { success: false, error: 'Debe seleccionar una tasa de impuesto válida.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // Verify tax_rate belongs to user's active company
    const { data: taxRate, error: taxErr } = await supabase
      .from('tax_rates')
      .select('id, company_id')
      .eq('id', input.tax_rate_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (taxErr || !taxRate) {
      return { success: false, error: 'La tasa de impuesto seleccionada no es válida para esta empresa.' };
    }

    // If supplier_id provided, verify supplier belongs to active company
    if (input.supplier_id) {
      const { data: supplier, error: suppErr } = await supabase
        .from('suppliers')
        .select('id, company_id')
        .eq('id', input.supplier_id)
        .eq('company_id', session.activeCompanyId)
        .single();

      if (suppErr || !supplier) {
        return { success: false, error: 'El proveedor seleccionado no pertenece a su empresa autorizada.' };
      }
    }

    const payload = {
      company_id: session.activeCompanyId,
      sku,
      name,
      description: input.description?.trim() || null,
      category: input.category?.trim() || 'General',
      product_type: input.product_type || 'physical',
      supplier_id: input.supplier_id || null,
      cost,
      sale_price: salePrice,
      tax_rate_id: input.tax_rate_id,
      stock_minimum: stockMinimum,
      is_inventory_item: input.product_type === 'service' ? false : (input.is_inventory_item ?? true),
      status: input.status || 'active',
      barcode: input.barcode?.trim() || null,
      created_by: session.id,
    };

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return {
          success: false,
          error: `Ya existe un producto con el SKU "${sku}" en esta empresa.`,
        };
      }
      return { success: false, error: insertError.message };
    }

    // Append to immutable audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'product',
      entity_id: product.id,
      after_json: product,
    });

    return {
      success: true,
      data: product as Product,
      message: 'Producto creado exitosamente.',
    };
  } catch (err: any) {
    console.error('[createProductAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al guardar el producto.' };
  }
}

/**
 * Updates an existing product with strict ownership verification, cross-company prevention, and audit diff.
 */
export async function updateProductAction(
  id: string,
  input: UpdateProductInput
): Promise<ActionResponse<Product>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador u Operaciones.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch before state
    const { data: beforeProduct, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !beforeProduct) {
      return { success: false, error: 'El producto no existe o pertenece a otra empresa.' };
    }

    const payload: Partial<Product> = {};

    if (input.sku !== undefined) {
      const sku = input.sku.trim().toUpperCase();
      if (!sku) return { success: false, error: 'El SKU no puede estar vacío.' };
      payload.sku = sku;
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) return { success: false, error: 'El nombre no puede estar vacío.' };
      payload.name = name;
    }

    if (input.description !== undefined) payload.description = input.description?.trim() || null;
    if (input.category !== undefined) payload.category = input.category?.trim() || 'General';
    if (input.product_type !== undefined) {
      payload.product_type = input.product_type;
      if (input.product_type === 'service') {
        payload.is_inventory_item = false;
      }
    }
    if (input.is_inventory_item !== undefined && payload.product_type !== 'service') {
      payload.is_inventory_item = input.is_inventory_item;
    }

    if (input.cost !== undefined) payload.cost = Math.max(0, Number(input.cost));
    if (input.sale_price !== undefined) payload.sale_price = Math.max(0, Number(input.sale_price));
    if (input.stock_minimum !== undefined) payload.stock_minimum = Math.max(0, Number(input.stock_minimum));
    if (input.status !== undefined) payload.status = input.status;
    if (input.barcode !== undefined) payload.barcode = input.barcode?.trim() || null;

    // Verify tax rate if modified
    if (input.tax_rate_id !== undefined) {
      const { data: tr } = await supabase
        .from('tax_rates')
        .select('id')
        .eq('id', input.tax_rate_id)
        .eq('company_id', session.activeCompanyId)
        .single();
      if (!tr) return { success: false, error: 'Tasa de impuesto inválida o pertenece a otra empresa.' };
      payload.tax_rate_id = input.tax_rate_id;
    }

    // Verify supplier if modified
    if (input.supplier_id !== undefined) {
      if (input.supplier_id) {
        const { data: sup } = await supabase
          .from('suppliers')
          .select('id')
          .eq('id', input.supplier_id)
          .eq('company_id', session.activeCompanyId)
          .single();
        if (!sup) return { success: false, error: 'Proveedor inválido o pertenece a otra empresa.' };
        payload.supplier_id = input.supplier_id;
      } else {
        payload.supplier_id = null;
      }
    }

    const { data: updatedProduct, error: updateErr } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select('*')
      .single();

    if (updateErr) {
      if (updateErr.code === '23505') {
        return { success: false, error: `Ya existe otro producto con el SKU indicado.` };
      }
      return { success: false, error: updateErr.message };
    }

    // Append to immutable audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'UPDATE',
      entity_type: 'product',
      entity_id: id,
      before_json: beforeProduct,
      after_json: updatedProduct,
    });

    return {
      success: true,
      data: updatedProduct as Product,
      message: 'Producto actualizado exitosamente.',
    };
  } catch (err: any) {
    console.error('[updateProductAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar el producto.' };
  }
}

/**
 * Toggles a product between active and inactive states.
 */
export async function toggleProductStatusAction(
  id: string,
  newStatus: 'active' | 'inactive'
): Promise<ActionResponse<Product>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para modificar el estado del producto.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: beforeProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (!beforeProduct) {
      return { success: false, error: 'Producto no encontrado.' };
    }

    const { data: updatedProduct, error } = await supabase
      .from('products')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: newStatus === 'inactive' ? 'ARCHIVE' : 'ACTIVATE',
      entity_type: 'product',
      entity_id: id,
      before_json: beforeProduct,
      after_json: updatedProduct,
    });

    return {
      success: true,
      data: updatedProduct as Product,
      message: `Producto ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente.`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cambiar estado del producto.' };
  }
}

/**
 * Fetches available tax rates for the active company.
 */
export async function getTaxRatesAction(): Promise<ActionResponse<TaxRate[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .eq('company_id', session.activeCompanyId)
    .eq('is_active', true)
    .order('rate', { ascending: false });

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: (data as TaxRate[]) || [] };
}

/**
 * Fetches active suppliers for selection in product forms.
 */
export async function getSuppliersListAction(): Promise<ActionResponse<Supplier[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('company_id', session.activeCompanyId)
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    return { success: false, error: error.message, data: [] };
  }

  return { success: true, data: (data as Supplier[]) || [] };
}
