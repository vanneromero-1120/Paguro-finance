// ============================================================================
// Paguro Finance - Purchases & Expenses Server Actions
// Multi-company isolated, RLS-enforced, stock-aware, audit-logged
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  PurchaseDocument,
  PurchaseDocumentItem,
  PurchaseDocumentWithSupplier,
  PurchaseDocumentWithDetails,
  CreatePurchaseDocumentInput,
  UpdatePurchaseDocumentInput,
  Supplier,
  Product,
  TaxRate,
} from '@/types/database';
import { roundHalfUp } from '@/lib/finance/calculations';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Retrieves all purchase documents / expenses for the user's active authorized company,
 * enriched with supplier data.
 */
export async function getPurchaseDocumentsAction(
  search?: string,
  statusFilter?: string,
  categoryFilter?: string,
  supplierId?: string
): Promise<ActionResponse<PurchaseDocumentWithSupplier[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar gastos y compras.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('purchase_documents')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (supplierId && supplierId !== 'all') {
      query = query.eq('supplier_id', supplierId);
    }

    if (categoryFilter && categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        query = query.gt('balance_due', 0).neq('status', 'void');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    query = query.order('document_date', { ascending: false }).order('created_at', { ascending: false });

    const { data: rawDocs, error: docError } = await query;
    if (docError) {
      console.error('[getPurchaseDocumentsAction] Query error:', docError);
      return { success: false, error: docError.message, data: [] };
    }

    if (!rawDocs || rawDocs.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch related suppliers
    const supplierIds = Array.from(new Set(rawDocs.map((d: any) => d.supplier_id).filter(Boolean)));
    let supplierMap = new Map<string, Supplier>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .in('id', supplierIds)
        .eq('company_id', session.activeCompanyId);
      (suppliers || []).forEach((s: Supplier) => supplierMap.set(s.id, s));
    }

    let enriched: PurchaseDocumentWithSupplier[] = rawDocs.map((d: any) => ({
      ...d,
      subtotal: Number(d.subtotal),
      deductible_tax_total: Number(d.deductible_tax_total),
      retention_total: Number(d.retention_total || 0),
      total: Number(d.total),
      paid_total: Number(d.paid_total),
      balance_due: Number(d.balance_due),
      supplier: d.supplier_id ? supplierMap.get(d.supplier_id) || null : null,
    }));

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      enriched = enriched.filter((d) =>
        d.document_number.toLowerCase().includes(term) ||
        d.category.toLowerCase().includes(term) ||
        d.supplier?.name.toLowerCase().includes(term) ||
        d.supplier?.tax_id?.toLowerCase().includes(term)
      );
    }

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getPurchaseDocumentsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener compras/gastos.', data: [] };
  }
}

/**
 * Retrieves a single purchase document / expense with lines, supplier, and payment history.
 */
export async function getPurchaseDocumentByIdAction(
  id: string
): Promise<ActionResponse<PurchaseDocumentWithDetails | null>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar el documento de compra.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch document header
    const { data: doc, error: docErr } = await supabase
      .from('purchase_documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: 'Documento de compra no encontrado o no pertenece a su empresa.' };
    }

    // 2. Fetch supplier
    let supplier: Supplier | null = null;
    if (doc.supplier_id) {
      const { data: sData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', doc.supplier_id)
        .eq('company_id', session.activeCompanyId)
        .single();
      supplier = sData || null;
    }

    // 3. Fetch purchase document items
    const { data: rawItems, error: itemsErr } = await supabase
      .from('purchase_document_items')
      .select('*')
      .eq('purchase_document_id', id)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      console.error('[getPurchaseDocumentByIdAction] Error fetching items:', itemsErr);
    }

    const items = rawItems || [];
    const productIds = Array.from(new Set(items.map((it: any) => it.product_id).filter(Boolean)));
    const taxRateIds = Array.from(new Set(items.map((it: any) => it.tax_rate_id).filter(Boolean)));

    // Fetch products
    let productMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('company_id', session.activeCompanyId);
      (products || []).forEach((p: Product) => productMap.set(p.id, p));
    }

    // Fetch tax rates
    let taxRateMap = new Map<string, TaxRate>();
    if (taxRateIds.length > 0) {
      const { data: taxRates } = await supabase
        .from('tax_rates')
        .select('*')
        .in('id', taxRateIds)
        .eq('company_id', session.activeCompanyId);
      (taxRates || []).forEach((tr: TaxRate) => taxRateMap.set(tr.id, tr));
    }

    const enrichedItems = items.map((it: any) => ({
      ...it,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      tax_rate: Number(it.tax_rate),
      tax_amount: Number(it.tax_amount),
      line_total: Number(it.line_total),
      product: it.product_id ? productMap.get(it.product_id) || null : null,
      tax_rate_obj: it.tax_rate_id ? taxRateMap.get(it.tax_rate_id) || null : null,
    }));

    // 4. Fetch payment allocations
    const { data: allocations } = await supabase
      .from('payment_allocations')
      .select('*, payment:payments(*)')
      .eq('document_type', 'purchase_document')
      .eq('document_id', id)
      .order('created_at', { ascending: false });

    const enrichedDoc: PurchaseDocumentWithDetails = {
      ...doc,
      subtotal: Number(doc.subtotal),
      deductible_tax_total: Number(doc.deductible_tax_total),
      retention_total: Number(doc.retention_total || 0),
      total: Number(doc.total),
      paid_total: Number(doc.paid_total),
      balance_due: Number(doc.balance_due),
      supplier: supplier,
      items: enrichedItems,
      payments: allocations || [],
    };

    return { success: true, data: enrichedDoc };
  } catch (err: any) {
    console.error('[getPurchaseDocumentByIdAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener el documento de compra.' };
  }
}

/**
 * Creates a purchase document / expense with authoritative server-side calculation,
 * cross-company validation, retention support, and stock reception if opened.
 */
export async function createPurchaseDocumentAction(
  input: CreatePurchaseDocumentInput
): Promise<ActionResponse<PurchaseDocument>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador o Finanzas.',
    };
  }

  if (!input.document_number || !input.document_number.trim()) {
    return { success: false, error: 'El número de factura o documento de soporte es obligatorio.' };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'Debe agregar al menos una línea de gasto o compra.' };
  }

  if (!input.document_date || !input.due_date) {
    return { success: false, error: 'Debe especificar fecha de documento y fecha de vencimiento.' };
  }

  if (new Date(input.due_date) < new Date(input.document_date)) {
    return { success: false, error: 'La fecha de vencimiento no puede ser anterior a la fecha del documento.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Verify supplier belongs to active company
    let supplier: Supplier | null = null;
    if (input.supplier_id) {
      const { data: sData, error: sErr } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', input.supplier_id)
        .eq('company_id', session.activeCompanyId)
        .single();

      if (sErr || !sData) {
        return { success: false, error: 'El proveedor seleccionado no existe o pertenece a otra empresa.' };
      }
      supplier = sData;

      // Check unique (company_id, supplier_id, document_number)
      const { data: existingDoc } = await supabase
        .from('purchase_documents')
        .select('id')
        .eq('company_id', session.activeCompanyId)
        .eq('supplier_id', sData.id)
        .eq('document_number', input.document_number.trim())
        .maybeSingle();

      if (existingDoc) {
        return {
          success: false,
          error: `Ya existe un documento con el número "${input.document_number}" registrado para este proveedor.`,
        };
      }
    }

    // 2. Fetch tax rates for validation
    const { data: taxRates } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    const taxRateMap = new Map<string, TaxRate>();
    (taxRates || []).forEach((tr: TaxRate) => taxRateMap.set(tr.id, tr));

    // 3. Fetch products if referenced
    const productIds = input.items.map((it) => it.product_id).filter(Boolean) as string[];
    let productMap = new Map<string, Product>();
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('company_id', session.activeCompanyId);

      (products || []).forEach((p: Product) => productMap.set(p.id, p));

      for (const pid of productIds) {
        if (!productMap.has(pid)) {
          return { success: false, error: 'Uno o más productos seleccionados no pertenecen a la empresa.' };
        }
      }
    }

    // 4. Validate lines & compute authoritative server-side values
    const targetStatus = input.status === 'draft' ? 'draft' : 'open';
    const computedLines: any[] = [];
    let subtotalSum = 0;
    let taxTotalSum = 0;

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price);

      if (isNaN(qty) || qty <= 0) {
        return { success: false, error: `La cantidad en la línea #${i + 1} debe ser mayor a cero.` };
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        return { success: false, error: `El costo unitario en la línea #${i + 1} no puede ser negativo.` };
      }

      let taxRateValue = 0;
      let taxRateId: string | null = null;

      if (item.tax_rate_id) {
        const trObj = taxRateMap.get(item.tax_rate_id);
        if (trObj) {
          taxRateId = trObj.id;
          taxRateValue = Number(trObj.rate);
        }
      } else if (item.tax_rate !== undefined) {
        taxRateValue = Number(item.tax_rate);
      }

      const rawSubtotal = roundHalfUp(qty * unitPrice, 2);
      const taxAmount = roundHalfUp(rawSubtotal * taxRateValue, 2);
      const lineTotal = roundHalfUp(rawSubtotal + taxAmount, 2);

      subtotalSum += rawSubtotal;
      taxTotalSum += taxAmount;

      computedLines.push({
        product_id: item.product_id || null,
        description: item.description.trim(),
        quantity: qty,
        unit_price: unitPrice,
        tax_rate_id: taxRateId,
        tax_rate: taxRateValue,
        tax_amount: taxAmount,
        line_total: lineTotal,
      });
    }

    subtotalSum = roundHalfUp(subtotalSum, 2);
    taxTotalSum = roundHalfUp(taxTotalSum, 2);
    const retentionTotal = Math.max(0, roundHalfUp(Number(input.retention_total || 0), 2));
    const total = roundHalfUp(subtotalSum + taxTotalSum, 2);

    // 5. Insert purchase document header
    const { data: doc, error: insErr } = await supabase
      .from('purchase_documents')
      .insert({
        company_id: session.activeCompanyId,
        document_number: input.document_number.trim(),
        supplier_id: supplier ? supplier.id : null,
        document_date: input.document_date,
        due_date: input.due_date,
        category: input.category || 'Gastos Operacionales',
        currency_code: input.currency_code || 'COP',
        subtotal: subtotalSum,
        deductible_tax_total: taxTotalSum,
        retention_total: retentionTotal,
        total: total,
        paid_total: 0.00,
        balance_due: total,
        status: targetStatus,
        notes: input.notes?.trim() || null,
        created_by: session.id,
      })
      .select()
      .single();

    if (insErr || !doc) {
      console.error('[createPurchaseDocumentAction] Insert header error:', insErr);
      return { success: false, error: insErr?.message || 'Error al guardar cabecera de compra.' };
    }

    // 6. Insert lines
    const linesPayload = computedLines.map((l) => ({
      ...l,
      purchase_document_id: doc.id,
    }));

    const { error: itemsInsErr } = await supabase
      .from('purchase_document_items')
      .insert(linesPayload);

    if (itemsInsErr) {
      console.error('[createPurchaseDocumentAction] Items insert error:', itemsInsErr);
      await supabase.from('purchase_documents').delete().eq('id', doc.id);
      return { success: false, error: 'Error al registrar los ítems de compra.' };
    }

    // 7. If status is 'open', increment inventory for physical products via PURCHASE movements
    if (targetStatus === 'open') {
      const movementsPayload: any[] = [];
      for (const line of computedLines) {
        if (!line.product_id) continue;
        const prod = productMap.get(line.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          movementsPayload.push({
            company_id: session.activeCompanyId,
            product_id: prod.id,
            movement_type: 'PURCHASE',
            movement_date: input.document_date ? new Date(input.document_date).toISOString() : new Date().toISOString(),
            quantity_delta: line.quantity,
            unit_cost: line.unit_price,
            source_type: 'purchase_document',
            source_id: doc.id,
            reason: `Compra Factura Proveedor ${doc.document_number}`,
            created_by: session.id,
          });
        }
      }

      if (movementsPayload.length > 0) {
        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert(movementsPayload);

        if (movErr) {
          console.error('[createPurchaseDocumentAction] Inventory movement error:', movErr);
        }
      }
    }

    // 8. Append audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'purchase_document',
      entity_id: doc.id,
      old_values: null,
      new_values: {
        document_number: doc.document_number,
        supplier_id: doc.supplier_id,
        status: doc.status,
        total: doc.total,
        item_count: computedLines.length,
      },
    });

    revalidatePath('/purchases/expenses');
    revalidatePath('/inventory');

    return {
      success: true,
      data: doc,
      message: `Documento de compra ${doc.document_number} registrado con éxito.`,
    };
  } catch (err: any) {
    console.error('[createPurchaseDocumentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al crear el documento de compra.' };
  }
}

/**
 * Updates a purchase document (ALLOWED ONLY IN DRAFT STATUS).
 */
export async function updatePurchaseDocumentAction(
  id: string,
  input: UpdatePurchaseDocumentInput
): Promise<ActionResponse<PurchaseDocument>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para editar compras.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: doc, error: docErr } = await supabase
      .from('purchase_documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: 'Documento no encontrado o no pertenece a su empresa.' };
    }

    if (doc.status !== 'draft') {
      return {
        success: false,
        error: `No se puede modificar un documento en estado "${doc.status}". Solo se pueden editar borradores.`,
      };
    }

    // If new items provided, validate and replace
    if (input.items && input.items.length > 0) {
      const { data: taxRates } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('company_id', session.activeCompanyId);
      const taxRateMap = new Map<string, TaxRate>();
      (taxRates || []).forEach((tr: TaxRate) => taxRateMap.set(tr.id, tr));

      const computedLines: any[] = [];
      for (const item of input.items) {
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unit_price);
        if (qty <= 0) return { success: false, error: 'Cantidad debe ser mayor a cero.' };
        if (unitPrice < 0) return { success: false, error: 'Costo no puede ser negativo.' };

        let taxRateValue = 0;
        let taxRateId: string | null = null;
        if (item.tax_rate_id) {
          const trObj = taxRateMap.get(item.tax_rate_id);
          if (trObj) {
            taxRateId = trObj.id;
            taxRateValue = Number(trObj.rate);
          }
        }

        const rawSubtotal = roundHalfUp(qty * unitPrice, 2);
        const taxAmount = roundHalfUp(rawSubtotal * taxRateValue, 2);
        const lineTotal = roundHalfUp(rawSubtotal + taxAmount, 2);

        computedLines.push({
          purchase_document_id: id,
          product_id: item.product_id || null,
          description: item.description.trim(),
          quantity: qty,
          unit_price: unitPrice,
          tax_rate_id: taxRateId,
          tax_rate: taxRateValue,
          tax_amount: taxAmount,
          line_total: lineTotal,
        });
      }

      await supabase.from('purchase_document_items').delete().eq('purchase_document_id', id);
      await supabase.from('purchase_document_items').insert(computedLines);
    }

    // Update header fields
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
      updated_by: session.id,
    };
    if (input.document_number) updatePayload.document_number = input.document_number.trim();
    if (input.supplier_id !== undefined) updatePayload.supplier_id = input.supplier_id;
    if (input.document_date) updatePayload.document_date = input.document_date;
    if (input.due_date) updatePayload.due_date = input.due_date;
    if (input.category) updatePayload.category = input.category;
    if (input.retention_total !== undefined) updatePayload.retention_total = Number(input.retention_total);
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

    const { data: updatedDoc, error: updErr } = await supabase
      .from('purchase_documents')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedDoc) {
      return { success: false, error: updErr?.message || 'Error al actualizar documento de compra.' };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'UPDATE',
      entity_type: 'purchase_document',
      entity_id: id,
      old_values: doc,
      new_values: updatedDoc,
    });

    revalidatePath('/purchases/expenses');
    revalidatePath(`/purchases/expenses/${id}`);

    return {
      success: true,
      data: updatedDoc,
      message: 'Documento de compra actualizado exitosamente.',
    };
  } catch (err: any) {
    console.error('[updatePurchaseDocumentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar documento de compra.' };
  }
}

/**
 * Finalizes/approves a draft purchase document to OPEN status.
 */
export async function openPurchaseDocumentAction(
  id: string
): Promise<ActionResponse<PurchaseDocument>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para aprobar compras.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: doc, error: docErr } = await supabase
      .from('purchase_documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: 'Documento no encontrado.' };
    }

    if (doc.status !== 'draft') {
      return { success: false, error: `El documento ya no está en borrador (estado actual: ${doc.status}).` };
    }

    // Fetch items for inventory stock reception
    const { data: items } = await supabase
      .from('purchase_document_items')
      .select('*')
      .eq('purchase_document_id', id);

    if (!items || items.length === 0) {
      return { success: false, error: 'No se puede aprobar un documento sin líneas de detalle.' };
    }

    // If physical products exist, record PURCHASE movements
    const productIds = items.map((it: any) => it.product_id).filter(Boolean);
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('company_id', session.activeCompanyId);

      const productMap = new Map<string, Product>();
      (products || []).forEach((p: Product) => productMap.set(p.id, p));

      const movementsPayload: any[] = [];
      for (const line of items) {
        if (!line.product_id) continue;
        const prod = productMap.get(line.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          movementsPayload.push({
            company_id: session.activeCompanyId,
            product_id: prod.id,
            movement_type: 'PURCHASE',
            movement_date: doc.document_date ? new Date(doc.document_date).toISOString() : new Date().toISOString(),
            quantity_delta: Number(line.quantity),
            unit_cost: Number(line.unit_price),
            source_type: 'purchase_document',
            source_id: doc.id,
            reason: `Entrada por Compra Factura ${doc.document_number}`,
            created_by: session.id,
          });
        }
      }

      if (movementsPayload.length > 0) {
        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert(movementsPayload);

        if (movErr) {
          console.error('[openPurchaseDocumentAction] Inventory movement error:', movErr);
          return { success: false, error: 'Error al registrar la entrada de inventario.' };
        }
      }
    }

    // Update status to 'open'
    const { data: updatedDoc, error: updErr } = await supabase
      .from('purchase_documents')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedDoc) {
      return { success: false, error: updErr?.message || 'Error al actualizar estado a abierto.' };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'OPEN',
      entity_type: 'purchase_document',
      entity_id: id,
      old_values: { status: 'draft' },
      new_values: { status: 'open', document_number: doc.document_number },
    });

    revalidatePath('/purchases/expenses');
    revalidatePath(`/purchases/expenses/${id}`);
    revalidatePath('/inventory');

    return {
      success: true,
      data: updatedDoc,
      message: `Documento ${doc.document_number} aprobado exitosamente.`,
    };
  } catch (err: any) {
    console.error('[openPurchaseDocumentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al aprobar documento de compra.' };
  }
}

/**
 * Voids a purchase document, reversing stock movements if any.
 * Restricted to SUPER_ADMIN and ADMIN.
 */
export async function voidPurchaseDocumentAction(
  id: string,
  reason?: string
): Promise<ActionResponse<PurchaseDocument>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!VOID_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo los roles SUPER_ADMIN y ADMIN pueden anular documentos de compra.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: doc, error: docErr } = await supabase
      .from('purchase_documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (docErr || !doc) {
      return { success: false, error: 'Documento no encontrado o no pertenece a su empresa.' };
    }

    if (doc.status === 'void') {
      return { success: false, error: 'El documento ya se encuentra anulado.' };
    }

    if (Number(doc.paid_total) > 0) {
      return {
        success: false,
        error: `No se puede anular un documento con pagos o desembolsos registrados ($${doc.paid_total}). Debe anular primero los pagos asociados.`,
      };
    }

    // Reverse inventory movements if PURCHASE movements exist
    const { data: purchaseMovements } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('source_type', 'purchase_document')
      .eq('source_id', id)
      .eq('company_id', session.activeCompanyId);

    if (purchaseMovements && purchaseMovements.length > 0) {
      const returnMovements = purchaseMovements.map((m: any) => ({
        company_id: session.activeCompanyId,
        product_id: m.product_id,
        movement_type: 'RETURN_OUT',
        movement_date: new Date().toISOString(),
        quantity_delta: -Math.abs(Number(m.quantity_delta)),
        unit_cost: Number(m.unit_cost || 0),
        source_type: 'purchase_document_void',
        source_id: id,
        reason: `Anulación de Compra ${doc.document_number}${reason ? ': ' + reason : ''}`,
        created_by: session.id,
      }));

      const { error: revErr } = await supabase
        .from('inventory_movements')
        .insert(returnMovements);

      if (revErr) {
        console.error('[voidPurchaseDocumentAction] Error reversing stock movements:', revErr);
        return { success: false, error: 'Error al registrar reversión de inventario de compra.' };
      }
    }

    // Mark as void
    const { data: updatedDoc, error: updErr } = await supabase
      .from('purchase_documents')
      .update({
        status: 'void',
        balance_due: 0.00,
        notes: doc.notes
          ? `${doc.notes}\n[ANULADO]: ${reason || 'Sin motivo especificado'}`
          : `[ANULADO]: ${reason || 'Sin motivo especificado'}`,
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedDoc) {
      return { success: false, error: updErr?.message || 'Error al anular el documento de compra.' };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'VOID',
      entity_type: 'purchase_document',
      entity_id: id,
      old_values: { status: doc.status, balance_due: doc.balance_due },
      new_values: { status: 'void', reason: reason || null },
    });

    revalidatePath('/purchases/expenses');
    revalidatePath(`/purchases/expenses/${id}`);
    revalidatePath('/inventory');

    return {
      success: true,
      data: updatedDoc,
      message: `Documento de compra ${doc.document_number} anulado exitosamente.`,
    };
  } catch (err: any) {
    console.error('[voidPurchaseDocumentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al anular el documento.' };
  }
}
