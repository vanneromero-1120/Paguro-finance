// ============================================================================
// Paguro Finance - Sales Invoice Server Actions
// Multi-company isolated, RLS-enforced, stock-aware, audit-logged
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  SalesInvoice,
  InvoiceWithCustomer,
  InvoiceWithDetails,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  Customer,
  Product,
  TaxRate,
} from '@/types/database';
import { calculateLineItem, calculateDocumentTotals, roundHalfUp } from '@/lib/finance/calculations';
import { validateInventoryMovement } from '@/lib/finance/inventory';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Retrieves all sales invoices for the user's active authorized company,
 * enriched with customer data.
 */
export async function getSalesInvoicesAction(
  search?: string,
  statusFilter?: string,
  customerId?: string
): Promise<ActionResponse<InvoiceWithCustomer[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar facturas.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('sales_invoices')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (customerId && customerId !== 'all') {
      query = query.eq('customer_id', customerId);
    }

    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        query = query.gt('balance_due', 0).neq('status', 'void');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data: rawInvoices, error: invError } = await query;
    if (invError) {
      console.error('[getSalesInvoicesAction] Query error:', invError);
      return { success: false, error: invError.message, data: [] };
    }

    if (!rawInvoices || rawInvoices.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch related customers
    const customerIds = Array.from(new Set(rawInvoices.map((inv: any) => inv.customer_id)));
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .in('id', customerIds)
      .eq('company_id', session.activeCompanyId);

    const customerMap = new Map<string, Customer>();
    (customers || []).forEach((c: Customer) => customerMap.set(c.id, c));

    let enriched: InvoiceWithCustomer[] = rawInvoices.map((inv: any) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      tax_total: Number(inv.tax_total),
      discount_total: Number(inv.discount_total),
      total: Number(inv.total),
      paid_total: Number(inv.paid_total),
      balance_due: Number(inv.balance_due),
      customer: customerMap.get(inv.customer_id) || null,
    }));

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      enriched = enriched.filter((inv) =>
        inv.invoice_number.toLowerCase().includes(term) ||
        inv.customer?.name.toLowerCase().includes(term) ||
        inv.customer?.tax_id?.toLowerCase().includes(term)
      );
    }

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getSalesInvoicesAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener facturas.', data: [] };
  }
}

/**
 * Retrieves a single sales invoice with lines, customer, and payments.
 */
export async function getSalesInvoiceByIdAction(
  id: string
): Promise<ActionResponse<InvoiceWithDetails | null>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar la factura.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch invoice header
    const { data: invoice, error: invErr } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: 'Factura no encontrada o no pertenece a su empresa.' };
    }

    // 2. Fetch customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', invoice.customer_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    // 3. Fetch invoice items
    const { data: rawItems, error: itemsErr } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      console.error('[getSalesInvoiceByIdAction] Error fetching items:', itemsErr);
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
      discount_amount: Number(it.discount_amount),
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
      .eq('document_type', 'sales_invoice')
      .eq('document_id', id)
      .order('created_at', { ascending: false });

    const enrichedInvoice: InvoiceWithDetails = {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      tax_total: Number(invoice.tax_total),
      discount_total: Number(invoice.discount_total),
      total: Number(invoice.total),
      paid_total: Number(invoice.paid_total),
      balance_due: Number(invoice.balance_due),
      customer: customer || null,
      items: enrichedItems,
      payments: allocations || [],
    };

    return { success: true, data: enrichedInvoice };
  } catch (err: any) {
    console.error('[getSalesInvoiceByIdAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener la factura.' };
  }
}

/**
 * Creates a new sales invoice with authoritative server-side calculations,
 * concurrency-safe numbering, multi-company validation, and inventory deduction if issued.
 */
export async function createSalesInvoiceAction(
  input: CreateInvoiceInput
): Promise<ActionResponse<SalesInvoice>> {
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

  if (!input.customer_id) {
    return { success: false, error: 'Debe seleccionar un cliente para la factura.' };
  }

  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'La factura debe contener al menos una línea de detalle.' };
  }

  if (!input.issue_date || !input.due_date) {
    return { success: false, error: 'Debe especificar fecha de emisión y fecha de vencimiento.' };
  }

  if (new Date(input.due_date) < new Date(input.issue_date)) {
    return { success: false, error: 'La fecha de vencimiento no puede ser anterior a la fecha de emisión.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Verify customer belongs to active company
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, name, status, company_id')
      .eq('id', input.customer_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (custErr || !customer) {
      return { success: false, error: 'El cliente no existe o pertenece a otra empresa.' };
    }

    if (customer.status === 'inactive') {
      return { success: false, error: 'No se pueden emitir facturas a clientes inactivos.' };
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

      // Verify all specified products exist and belong to company
      for (const pid of productIds) {
        if (!productMap.has(pid)) {
          return { success: false, error: 'Uno o más productos seleccionados no pertenecen a la empresa.' };
        }
      }
    }

    // 4. Validate lines & compute authoritative server-side values
    const targetStatus = input.status === 'issued' ? 'issued' : 'draft';
    const computedLines: any[] = [];
    const stockRequirements = new Map<string, number>();

    for (const item of input.items) {
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const discount = Number(item.discount_amount || 0);

      if (isNaN(qty) || qty <= 0) {
        return { success: false, error: 'La cantidad de cada línea debe ser mayor a cero.' };
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        return { success: false, error: 'El precio unitario no puede ser negativo.' };
      }
      if (isNaN(discount) || discount < 0) {
        return { success: false, error: 'El descuento no puede ser negativo.' };
      }

      const taxRateObj = taxRateMap.get(item.tax_rate_id);
      if (!taxRateObj) {
        return { success: false, error: 'Debe seleccionar un tipo de impuesto/IVA válido para cada línea.' };
      }

      const calculated = calculateLineItem({
        quantity: qty,
        unitPrice: unitPrice,
        discountAmount: discount,
        taxRate: Number(taxRateObj.rate),
      });

      computedLines.push({
        product_id: item.product_id || null,
        description: item.description.trim(),
        quantity: calculated.quantity,
        unit_price: calculated.unitPrice,
        discount_amount: calculated.discountAmount,
        tax_rate_id: taxRateObj.id,
        tax_rate: Number(taxRateObj.rate),
        tax_amount: calculated.taxAmount,
        line_total: calculated.lineTotal,
      });

      // Track stock requirement if product is physical & tracked
      if (item.product_id) {
        const prod = productMap.get(item.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          const currentReq = stockRequirements.get(prod.id) || 0;
          stockRequirements.set(prod.id, currentReq + qty);
        }
      }
    }

    // 5. If issuing immediately, enforce stock availability
    if (targetStatus === 'issued' && stockRequirements.size > 0) {
      for (const [prodId, requiredQty] of stockRequirements.entries()) {
        const prod = productMap.get(prodId)!;
        const { data: movements } = await supabase
          .from('inventory_movements')
          .select('quantity_delta')
          .eq('product_id', prodId)
          .eq('company_id', session.activeCompanyId);

        const currentStock = roundHalfUp(
          (movements || []).reduce((sum: number, m: any) => sum + Number(m.quantity_delta || 0), 0),
          4
        );

        const validation = validateInventoryMovement(currentStock, -requiredQty, false);
        if (!validation.valid) {
          return {
            success: false,
            error: `Stock insuficiente para "${prod.name}". Stock actual: ${currentStock}, Requerido: ${requiredQty}.`,
          };
        }
      }
    }

    // 6. Concurrency-safe invoice numbering via database function
    const { data: numData, error: numError } = await supabase
      .rpc('generate_next_sales_invoice_number', { p_company_id: session.activeCompanyId });

    if (numError || !numData) {
      console.error('[createSalesInvoiceAction] Number generation error:', numError);
      return { success: false, error: 'Error al generar número de factura único y concurrente.' };
    }
    const invoiceNumber = numData as string;

    // 7. Calculate authoritative document totals
    const docTotals = calculateDocumentTotals(computedLines, 0);

    // 8. Insert invoice header
    const { data: invoice, error: insErr } = await supabase
      .from('sales_invoices')
      .insert({
        company_id: session.activeCompanyId,
        invoice_number: invoiceNumber,
        customer_id: input.customer_id,
        issue_date: input.issue_date,
        due_date: input.due_date,
        currency_code: input.currency_code || 'COP',
        subtotal: docTotals.subtotal,
        tax_total: docTotals.taxTotal,
        discount_total: docTotals.discountTotal,
        total: docTotals.total,
        paid_total: 0.00,
        balance_due: docTotals.total,
        status: targetStatus,
        notes: input.notes?.trim() || null,
        created_by: session.id,
      })
      .select()
      .single();

    if (insErr || !invoice) {
      console.error('[createSalesInvoiceAction] Insert header error:', insErr);
      return { success: false, error: insErr?.message || 'Error al guardar la cabecera de la factura.' };
    }

    // 9. Insert invoice items
    const itemsPayload = computedLines.map((line) => ({
      ...line,
      invoice_id: invoice.id,
    }));

    const { error: itemsInsErr } = await supabase
      .from('sales_invoice_items')
      .insert(itemsPayload);

    if (itemsInsErr) {
      console.error('[createSalesInvoiceAction] Insert items error:', itemsInsErr);
      // Attempt rollback of header if items insert fails
      await supabase.from('sales_invoices').delete().eq('id', invoice.id);
      return { success: false, error: 'Error al guardar los ítems de la factura.' };
    }

    // 10. If issued, record inventory movements for physical items
    if (targetStatus === 'issued' && stockRequirements.size > 0) {
      const movementRows: any[] = [];
      for (const line of computedLines) {
        if (!line.product_id) continue;
        const prod = productMap.get(line.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          movementRows.push({
            company_id: session.activeCompanyId,
            product_id: prod.id,
            movement_type: 'SALE',
            movement_date: input.issue_date ? new Date(input.issue_date).toISOString() : new Date().toISOString(),
            quantity_delta: -line.quantity,
            unit_cost: Number(prod.cost || 0),
            source_type: 'sales_invoice',
            source_id: invoice.id,
            reason: `Venta Factura ${invoiceNumber}`,
            created_by: session.id,
          });
        }
      }

      if (movementRows.length > 0) {
        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert(movementRows);

        if (movErr) {
          console.error('[createSalesInvoiceAction] Inventory movement error:', movErr);
        }
      }
    }

    // 11. Append audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'sales_invoice',
      entity_id: invoice.id,
      old_values: null,
      new_values: {
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        status: invoice.status,
        total: invoice.total,
        item_count: computedLines.length,
      },
    });

    revalidatePath('/sales/invoices');
    revalidatePath('/inventory');

    return {
      success: true,
      data: invoice,
      message: `Factura ${invoiceNumber} creada con éxito.`,
    };
  } catch (err: any) {
    console.error('[createSalesInvoiceAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al crear la factura.' };
  }
}

/**
 * Updates a sales invoice (ALLOWED ONLY IN DRAFT STATUS).
 */
export async function updateSalesInvoiceAction(
  id: string,
  input: UpdateInvoiceInput
): Promise<ActionResponse<SalesInvoice>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para editar facturas.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch current invoice
    const { data: invoice, error: invErr } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: 'Factura no encontrada o no pertenece a su empresa.' };
    }

    // Strict financial lifecycle check: only DRAFT can be modified
    if (invoice.status !== 'draft') {
      return {
        success: false,
        error: `No se puede modificar una factura en estado "${invoice.status}". Solo se pueden editar borradores.`,
      };
    }

    // If new items are provided, validate and replace
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
        const discount = Number(item.discount_amount || 0);

        if (qty <= 0) return { success: false, error: 'Cantidad debe ser mayor a cero.' };
        if (unitPrice < 0) return { success: false, error: 'Precio unitario no puede ser negativo.' };

        const taxRateObj = taxRateMap.get(item.tax_rate_id);
        if (!taxRateObj) return { success: false, error: 'Impuesto no válido.' };

        const calculated = calculateLineItem({
          quantity: qty,
          unitPrice: unitPrice,
          discountAmount: discount,
          taxRate: Number(taxRateObj.rate),
        });

        computedLines.push({
          invoice_id: id,
          product_id: item.product_id || null,
          description: item.description.trim(),
          quantity: calculated.quantity,
          unit_price: calculated.unitPrice,
          discount_amount: calculated.discountAmount,
          tax_rate_id: taxRateObj.id,
          tax_rate: Number(taxRateObj.rate),
          tax_amount: calculated.taxAmount,
          line_total: calculated.lineTotal,
        });
      }

      // Delete old items and insert new ones
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', id);
      await supabase.from('sales_invoice_items').insert(computedLines);
    }

    // Update header fields
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
      updated_by: session.id,
    };
    if (input.customer_id) updatePayload.customer_id = input.customer_id;
    if (input.issue_date) updatePayload.issue_date = input.issue_date;
    if (input.due_date) updatePayload.due_date = input.due_date;
    if (input.notes !== undefined) updatePayload.notes = input.notes?.trim() || null;

    const { data: updatedInvoice, error: updErr } = await supabase
      .from('sales_invoices')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedInvoice) {
      return { success: false, error: updErr?.message || 'Error al actualizar la factura.' };
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'UPDATE',
      entity_type: 'sales_invoice',
      entity_id: id,
      old_values: invoice,
      new_values: updatedInvoice,
    });

    revalidatePath('/sales/invoices');
    revalidatePath(`/sales/invoices/${id}`);

    return {
      success: true,
      data: updatedInvoice,
      message: 'Factura actualizada con éxito.',
    };
  } catch (err: any) {
    console.error('[updateSalesInvoiceAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar la factura.' };
  }
}

/**
 * Issues/finalizes a draft invoice. Enforces inventory stock availability and records stock movements.
 */
export async function issueSalesInvoiceAction(
  id: string
): Promise<ActionResponse<SalesInvoice>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para emitir facturas.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: 'Factura no encontrada.' };
    }

    if (invoice.status !== 'draft') {
      return { success: false, error: `La factura ya no es un borrador (estado actual: ${invoice.status}).` };
    }

    // 2. Fetch items
    const { data: items } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('invoice_id', id);

    if (!items || items.length === 0) {
      return { success: false, error: 'No se puede emitir una factura sin líneas de detalle.' };
    }

    // 3. Check inventory for tracked physical products
    const productIds = items.map((it: any) => it.product_id).filter(Boolean);
    let productMap = new Map<string, Product>();

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('company_id', session.activeCompanyId);
      (products || []).forEach((p: Product) => productMap.set(p.id, p));
    }

    const stockRequirements = new Map<string, number>();
    for (const line of items) {
      if (line.product_id) {
        const prod = productMap.get(line.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          const current = stockRequirements.get(prod.id) || 0;
          stockRequirements.set(prod.id, current + Number(line.quantity));
        }
      }
    }

    for (const [prodId, requiredQty] of stockRequirements.entries()) {
      const prod = productMap.get(prodId)!;
      const { data: movements } = await supabase
        .from('inventory_movements')
        .select('quantity_delta')
        .eq('product_id', prodId)
        .eq('company_id', session.activeCompanyId);

      const currentStock = roundHalfUp(
        (movements || []).reduce((sum: number, m: any) => sum + Number(m.quantity_delta || 0), 0),
        4
      );

      const validation = validateInventoryMovement(currentStock, -requiredQty, false);
      if (!validation.valid) {
        return {
          success: false,
          error: `Stock insuficiente para "${prod.name}". Stock actual: ${currentStock}, Requerido: ${requiredQty}.`,
        };
      }
    }

    // 4. Check idempotency: ensure no movements exist for this invoice
    const { data: existingMovements } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('source_type', 'sales_invoice')
      .eq('source_id', id)
      .eq('company_id', session.activeCompanyId);

    if (!existingMovements || existingMovements.length === 0) {
      // Record SALE movements
      const movementsPayload: any[] = [];
      for (const line of items) {
        if (!line.product_id) continue;
        const prod = productMap.get(line.product_id);
        if (prod && prod.is_inventory_item && prod.product_type === 'physical') {
          movementsPayload.push({
            company_id: session.activeCompanyId,
            product_id: prod.id,
            movement_type: 'SALE',
            movement_date: invoice.issue_date ? new Date(invoice.issue_date).toISOString() : new Date().toISOString(),
            quantity_delta: -Number(line.quantity),
            unit_cost: Number(prod.cost || 0),
            source_type: 'sales_invoice',
            source_id: invoice.id,
            reason: `Venta Factura ${invoice.invoice_number}`,
            created_by: session.id,
          });
        }
      }

      if (movementsPayload.length > 0) {
        const { error: movErr } = await supabase
          .from('inventory_movements')
          .insert(movementsPayload);

        if (movErr) {
          console.error('[issueSalesInvoiceAction] Error recording movements:', movErr);
          return { success: false, error: 'Error al registrar la salida de inventario.' };
        }
      }
    }

    // 5. Update invoice status to 'issued'
    const { data: updatedInvoice, error: updErr } = await supabase
      .from('sales_invoices')
      .update({
        status: 'issued',
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedInvoice) {
      return { success: false, error: updErr?.message || 'Error al cambiar estado a emitida.' };
    }

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'ISSUE',
      entity_type: 'sales_invoice',
      entity_id: id,
      old_values: { status: 'draft' },
      new_values: { status: 'issued', invoice_number: invoice.invoice_number },
    });

    revalidatePath('/sales/invoices');
    revalidatePath(`/sales/invoices/${id}`);
    revalidatePath('/inventory');

    return {
      success: true,
      data: updatedInvoice,
      message: `Factura ${invoice.invoice_number} emitida con éxito.`,
    };
  } catch (err: any) {
    console.error('[issueSalesInvoiceAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al emitir la factura.' };
  }
}

/**
 * Voids a sales invoice, reversing any inventory movements and updating status to VOID.
 * Restricted to SUPER_ADMIN and ADMIN.
 */
export async function voidSalesInvoiceAction(
  id: string,
  reason?: string
): Promise<ActionResponse<SalesInvoice>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!VOID_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo los roles SUPER_ADMIN y ADMIN pueden anular facturas.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch invoice
    const { data: invoice, error: invErr } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: 'Factura no encontrada o no pertenece a su empresa.' };
    }

    if (invoice.status === 'void') {
      return { success: false, error: 'La factura ya se encuentra anulada.' };
    }

    // Financial integrity rule: invoices with payments cannot be voided directly
    if (Number(invoice.paid_total) > 0) {
      return {
        success: false,
        error: `No se puede anular una factura con pagos registrados ($${invoice.paid_total}). Debe anular primero los cobros asociados.`,
      };
    }

    // 2. Compensatory inventory reversal (if SALE movements exist)
    const { data: saleMovements } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('source_type', 'sales_invoice')
      .eq('source_id', id)
      .eq('company_id', session.activeCompanyId);

    if (saleMovements && saleMovements.length > 0) {
      const returnMovements = saleMovements.map((m: any) => ({
        company_id: session.activeCompanyId,
        product_id: m.product_id,
        movement_type: 'RETURN_IN',
        movement_date: new Date().toISOString(),
        quantity_delta: Math.abs(Number(m.quantity_delta)),
        unit_cost: Number(m.unit_cost || 0),
        source_type: 'sales_invoice_void',
        source_id: id,
        reason: `Anulación de Factura ${invoice.invoice_number}${reason ? ': ' + reason : ''}`,
        created_by: session.id,
      }));

      const { error: revErr } = await supabase
        .from('inventory_movements')
        .insert(returnMovements);

      if (revErr) {
        console.error('[voidSalesInvoiceAction] Error inserting compensatory movements:', revErr);
        return { success: false, error: 'Error al registrar reversión de inventario.' };
      }
    }

    // 3. Mark invoice as VOID and set balance_due to 0
    const { data: updatedInvoice, error: updErr } = await supabase
      .from('sales_invoices')
      .update({
        status: 'void',
        balance_due: 0.00,
        notes: invoice.notes
          ? `${invoice.notes}\n[ANULADA]: ${reason || 'Sin motivo especificado'}`
          : `[ANULADA]: ${reason || 'Sin motivo especificado'}`,
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedInvoice) {
      return { success: false, error: updErr?.message || 'Error al anular la factura.' };
    }

    // 4. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'VOID',
      entity_type: 'sales_invoice',
      entity_id: id,
      old_values: { status: invoice.status, balance_due: invoice.balance_due },
      new_values: { status: 'void', reason: reason || null },
    });

    revalidatePath('/sales/invoices');
    revalidatePath(`/sales/invoices/${id}`);
    revalidatePath('/inventory');

    return {
      success: true,
      data: updatedInvoice,
      message: `Factura ${invoice.invoice_number} anulada correctamente.`,
    };
  } catch (err: any) {
    console.error('[voidSalesInvoiceAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al anular la factura.' };
  }
}
