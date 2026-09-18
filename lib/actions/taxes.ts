// ============================================================================
// Paguro Finance - Taxes & Tax Periods (IVA) Server Actions
// Multi-company isolated, RLS-enforced, Line-level traceability, Real calculations
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  TaxPeriod,
  TaxPeriodStatus,
  TaxAdjustment,
  CreateTaxPeriodInput,
  CreateTaxAdjustmentInput,
  TaxPeriodWithCalculations,
  TaxSourceSalesItem,
  TaxSourcePurchaseItem,
} from '@/types/database';
import { roundHalfUp } from '@/lib/finance/calculations';
import {
  calculateNetVat,
  calculateAdjustmentDelta,
  doPeriodsOverlap,
} from '@/lib/finance/taxes';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];
const MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const CLOSE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

/**
 * Retrieves all tax periods for the user's active company, enriched with
 * live operational calculations of IVA Generado (sales) and IVA Descontable (purchases).
 */
export async function getTaxPeriodsAction(): Promise<ActionResponse<TaxPeriodWithCalculations[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar periodos de impuestos.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    // 1. Fetch tax periods for company
    const { data: rawPeriods, error: periodsErr } = await supabase
      .from('tax_periods')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('period_start', { ascending: false });

    if (periodsErr) {
      console.error('[getTaxPeriodsAction] Error fetching periods:', periodsErr);
      return { success: false, error: periodsErr.message, data: [] };
    }

    if (!rawPeriods || rawPeriods.length === 0) {
      return { success: true, data: [] };
    }

    // 2. Fetch all sales invoices for this company (eligible statuses: issued, partial, paid)
    const { data: rawInvoices, error: invErr } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, issue_date, customer_id, subtotal, tax_total, total, status')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['issued', 'partial', 'paid']);

    if (invErr) {
      console.error('[getTaxPeriodsAction] Error fetching invoices:', invErr);
    }
    const invoices = rawInvoices || [];

    // 3. Fetch all purchase documents for this company (eligible statuses: open, partial, paid)
    const { data: rawPurchases, error: purErr } = await supabase
      .from('purchase_documents')
      .select('id, document_number, document_date, supplier_id, category, subtotal, deductible_tax_total, total, status')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['open', 'partial', 'paid']);

    if (purErr) {
      console.error('[getTaxPeriodsAction] Error fetching purchases:', purErr);
    }
    const purchases = rawPurchases || [];

    // 4. Fetch all tax adjustments for periods of this company
    const periodIds = rawPeriods.map((p: any) => p.id);
    const { data: rawAdjustments, error: adjErr } = await supabase
      .from('tax_adjustments')
      .select('*')
      .in('tax_period_id', periodIds)
      .order('created_at', { ascending: true });

    if (adjErr) {
      console.error('[getTaxPeriodsAction] Error fetching adjustments:', adjErr);
    }
    const adjustments = rawAdjustments || [];

    // 5. Build enriched calculation for each period
    const enriched: TaxPeriodWithCalculations[] = [];

    for (const period of rawPeriods) {
      const pStart = period.period_start;
      const pEnd = period.period_end;

      // Filter matching sales in date range [pStart, pEnd]
      const matchingSales = invoices.filter((inv: any) => {
        return inv.issue_date >= pStart && inv.issue_date <= pEnd;
      });

      // Filter matching purchases in date range [pStart, pEnd]
      const matchingPurchases = purchases.filter((pur: any) => {
        return pur.document_date >= pStart && pur.document_date <= pEnd;
      });

      // Filter matching adjustments
      const matchingAdj = adjustments.filter((adj: any) => adj.tax_period_id === period.id);

      // Calculations
      let salesTaxableBase = 0;
      let generatedTaxSum = 0;
      for (const inv of matchingSales) {
        salesTaxableBase += Number(inv.subtotal || 0);
        generatedTaxSum += Number(inv.tax_total || 0);
      }
      salesTaxableBase = roundHalfUp(salesTaxableBase, 2);
      generatedTaxSum = roundHalfUp(generatedTaxSum, 2);

      let purchasesTaxableBase = 0;
      let deductibleTaxSum = 0;
      for (const pur of matchingPurchases) {
        purchasesTaxableBase += Number(pur.subtotal || 0);
        deductibleTaxSum += Number(pur.deductible_tax_total || 0);
      }
      purchasesTaxableBase = roundHalfUp(purchasesTaxableBase, 2);
      deductibleTaxSum = roundHalfUp(deductibleTaxSum, 2);

      let adjustmentsSum = 0;
      for (const adj of matchingAdj) {
        adjustmentsSum += calculateAdjustmentDelta(adj.adjustment_type, Number(adj.amount || 0));
      }
      adjustmentsSum = roundHalfUp(adjustmentsSum, 2);

      const netTax = calculateNetVat(generatedTaxSum, deductibleTaxSum, adjustmentsSum);

      // If period is OPEN or REVIEWED, sync live calculated numbers to the database if they differ
      if (
        (period.status === 'open' || period.status === 'reviewed' || period.status === 'reopened') &&
        (Number(period.generated_tax) !== generatedTaxSum ||
          Number(period.deductible_tax) !== deductibleTaxSum ||
          Number(period.adjustments) !== adjustmentsSum ||
          Number(period.net_tax) !== netTax)
      ) {
        await supabase
          .from('tax_periods')
          .update({
            generated_tax: generatedTaxSum,
            deductible_tax: deductibleTaxSum,
            adjustments: adjustmentsSum,
            net_tax: netTax,
            updated_at: new Date().toISOString(),
          })
          .eq('id', period.id);
      }

      enriched.push({
        ...period,
        generated_tax: generatedTaxSum,
        deductible_tax: deductibleTaxSum,
        adjustments: adjustmentsSum,
        net_tax: netTax,
        sales_count: matchingSales.length,
        sales_taxable_base: salesTaxableBase,
        purchases_count: matchingPurchases.length,
        purchases_taxable_base: purchasesTaxableBase,
        adjustments_list: matchingAdj.map((adj: any) => ({
          ...adj,
          amount: Number(adj.amount),
        })),
      });
    }

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getTaxPeriodsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener periodos de IVA.', data: [] };
  }
}

/**
 * Retrieves a single tax period with full line-item drill-down into source
 * sales invoices and purchase documents.
 */
export async function getTaxPeriodByIdAction(
  id: string
): Promise<ActionResponse<TaxPeriodWithCalculations | null>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar el periodo de IVA.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch period
    const { data: period, error: periodErr } = await supabase
      .from('tax_periods')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (periodErr || !period) {
      return { success: false, error: 'Periodo de IVA no encontrado.' };
    }

    const pStart = period.period_start;
    const pEnd = period.period_end;

    // 2. Fetch sales invoices in period with customer names
    const { data: rawInvoices } = await supabase
      .from('sales_invoices')
      .select('id, invoice_number, issue_date, customer_id, subtotal, tax_total, total, status')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['issued', 'partial', 'paid'])
      .gte('issue_date', pStart)
      .lte('issue_date', pEnd)
      .order('issue_date', { ascending: false });

    const invoices = rawInvoices || [];
    const customerIds = Array.from(new Set(invoices.map((i: any) => i.customer_id).filter(Boolean)));
    const customerMap = new Map<string, { name: string; tax_id?: string | null }>();

    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, tax_id')
        .in('id', customerIds);
      (customers || []).forEach((c: any) => customerMap.set(c.id, { name: c.name, tax_id: c.tax_id }));
    }

    const salesItems: TaxSourceSalesItem[] = invoices.map((inv: any) => {
      const cust = customerMap.get(inv.customer_id);
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        customer_name: cust?.name || 'Cliente',
        customer_tax_id: cust?.tax_id || null,
        subtotal: Number(inv.subtotal),
        tax_total: Number(inv.tax_total),
        total: Number(inv.total),
        status: inv.status,
      };
    });

    // 3. Fetch purchase documents in period with supplier names
    const { data: rawPurchases } = await supabase
      .from('purchase_documents')
      .select('id, document_number, document_date, supplier_id, category, subtotal, deductible_tax_total, total, status')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['open', 'partial', 'paid'])
      .gte('document_date', pStart)
      .lte('document_date', pEnd)
      .order('document_date', { ascending: false });

    const purchases = rawPurchases || [];
    const supplierIds = Array.from(new Set(purchases.map((p: any) => p.supplier_id).filter(Boolean)));
    const supplierMap = new Map<string, { name: string; tax_id?: string | null }>();

    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, tax_id')
        .in('id', supplierIds);
      (suppliers || []).forEach((s: any) => supplierMap.set(s.id, { name: s.name, tax_id: s.tax_id }));
    }

    const purchaseItems: TaxSourcePurchaseItem[] = purchases.map((pur: any) => {
      const supp = supplierMap.get(pur.supplier_id);
      return {
        id: pur.id,
        document_number: pur.document_number,
        document_date: pur.document_date,
        supplier_name: supp?.name || 'Proveedor General',
        supplier_tax_id: supp?.tax_id || null,
        category: pur.category,
        subtotal: Number(pur.subtotal),
        deductible_tax_total: Number(pur.deductible_tax_total),
        total: Number(pur.total),
        status: pur.status,
      };
    });

    // 4. Fetch adjustments
    const { data: rawAdj } = await supabase
      .from('tax_adjustments')
      .select('*')
      .eq('tax_period_id', id)
      .order('created_at', { ascending: true });

    const adjustments = (rawAdj || []).map((adj: any) => ({
      ...adj,
      amount: Number(adj.amount),
    }));

    // 5. Aggregate totals
    const salesTaxableBase = roundHalfUp(salesItems.reduce((acc, it) => acc + it.subtotal, 0), 2);
    const generatedTaxSum = roundHalfUp(salesItems.reduce((acc, it) => acc + it.tax_total, 0), 2);
    const purchasesTaxableBase = roundHalfUp(purchaseItems.reduce((acc, it) => acc + it.subtotal, 0), 2);
    const deductibleTaxSum = roundHalfUp(purchaseItems.reduce((acc, it) => acc + it.deductible_tax_total, 0), 2);

    let adjustmentsSum = 0;
    for (const adj of adjustments) {
      adjustmentsSum += calculateAdjustmentDelta(adj.adjustment_type, adj.amount);
    }
    adjustmentsSum = roundHalfUp(adjustmentsSum, 2);

    const netTax = calculateNetVat(generatedTaxSum, deductibleTaxSum, adjustmentsSum);

    const result: TaxPeriodWithCalculations = {
      ...period,
      generated_tax: generatedTaxSum,
      deductible_tax: deductibleTaxSum,
      adjustments: adjustmentsSum,
      net_tax: netTax,
      sales_count: salesItems.length,
      sales_taxable_base: salesTaxableBase,
      purchases_count: purchaseItems.length,
      purchases_taxable_base: purchasesTaxableBase,
      adjustments_list: adjustments,
      sales_items: salesItems,
      purchases_items: purchaseItems,
    };

    return { success: true, data: result };
  } catch (err: any) {
    console.error('[getTaxPeriodByIdAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener detalle del periodo de IVA.' };
  }
}

/**
 * Creates a configurable tax period with non-overlapping validation.
 * Restricted to SUPER_ADMIN, ADMIN, ACCOUNTANT.
 */
export async function createTaxPeriodAction(
  input: CreateTaxPeriodInput
): Promise<ActionResponse<TaxPeriod>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!MANAGE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador o Contador.',
    };
  }

  if (!input.period_start || !input.period_end) {
    return { success: false, error: 'Debe especificar fecha de inicio y fecha de fin del periodo.' };
  }

  if (new Date(input.period_end) < new Date(input.period_start)) {
    return { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio.' };
  }

  const taxType = input.tax_type || 'IVA';
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Check for overlapping periods for same company & tax_type
    const { data: existingPeriods } = await supabase
      .from('tax_periods')
      .select('id, period_start, period_end, status')
      .eq('company_id', session.activeCompanyId)
      .eq('tax_type', taxType);

    if (existingPeriods && existingPeriods.length > 0) {
      for (const p of existingPeriods) {
        if (doPeriodsOverlap(input.period_start, input.period_end, p.period_start, p.period_end)) {
          return {
            success: false,
            error: `El intervalo seleccionado (${input.period_start} a ${input.period_end}) se solapa con el periodo existente (${p.period_start} a ${p.period_end}, Estado: ${p.status}).`,
          };
        }
      }
    }

    // 2. Compute initial live sales & purchase totals in date range
    const { data: salesInvoices } = await supabase
      .from('sales_invoices')
      .select('tax_total')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['issued', 'partial', 'paid'])
      .gte('issue_date', input.period_start)
      .lte('issue_date', input.period_end);

    const initialGenerated = roundHalfUp(
      (salesInvoices || []).reduce((acc, i) => acc + Number(i.tax_total || 0), 0),
      2
    );

    const { data: purchaseDocs } = await supabase
      .from('purchase_documents')
      .select('deductible_tax_total')
      .eq('company_id', session.activeCompanyId)
      .in('status', ['open', 'partial', 'paid'])
      .gte('document_date', input.period_start)
      .lte('document_date', input.period_end);

    const initialDeductible = roundHalfUp(
      (purchaseDocs || []).reduce((acc, p) => acc + Number(p.deductible_tax_total || 0), 0),
      2
    );

    const initialNetTax = calculateNetVat(initialGenerated, initialDeductible, 0);

    // 3. Insert tax period
    const { data: newPeriod, error: insErr } = await supabase
      .from('tax_periods')
      .insert({
        company_id: session.activeCompanyId,
        tax_type: taxType,
        period_start: input.period_start,
        period_end: input.period_end,
        generated_tax: initialGenerated,
        deductible_tax: initialDeductible,
        adjustments: 0.00,
        net_tax: initialNetTax,
        status: 'open',
        notes: input.notes?.trim() || null,
        created_by: session.id,
      })
      .select()
      .single();

    if (insErr || !newPeriod) {
      console.error('[createTaxPeriodAction] Insert error:', insErr);
      return { success: false, error: insErr?.message || 'Error al crear el periodo de impuestos.' };
    }

    // 4. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'tax_period',
      entity_id: newPeriod.id,
      before_json: null,
      after_json: {
        tax_type: newPeriod.tax_type,
        period_start: newPeriod.period_start,
        period_end: newPeriod.period_end,
        status: newPeriod.status,
      },
    });

    revalidatePath('/taxes/iva');

    return {
      success: true,
      data: newPeriod,
      message: `Periodo de IVA (${newPeriod.period_start} a ${newPeriod.period_end}) creado exitosamente.`,
    };
  } catch (err: any) {
    console.error('[createTaxPeriodAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al registrar periodo de impuestos.' };
  }
}

/**
 * Updates a tax period status (open -> reviewed -> closed -> reopened).
 * Closing or reopening enforces strict authorization rules.
 */
export async function updateTaxPeriodStatusAction(
  id: string,
  newStatus: TaxPeriodStatus,
  notes?: string
): Promise<ActionResponse<TaxPeriod>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch current period
    const { data: period, error: fetchErr } = await supabase
      .from('tax_periods')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !period) {
      return { success: false, error: 'Periodo de impuestos no encontrado.' };
    }

    // 2. Validate role permissions for transition
    if (newStatus === 'closed' || newStatus === 'reopened') {
      if (!CLOSE_ROLES.includes(session.activeRole)) {
        return {
          success: false,
          error: `Permiso denegado. Solo los roles Administrador y Contador pueden ${newStatus === 'closed' ? 'cerrar' : 'reabrir'} un periodo fiscal.`,
        };
      }
    } else {
      if (!MANAGE_ROLES.includes(session.activeRole)) {
        return {
          success: false,
          error: 'Permiso denegado para modificar el estado del periodo fiscal.',
        };
      }
    }

    // 3. Prepare payload
    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updatePayload.notes = notes ? notes.trim() : null;
    }

    if (newStatus === 'closed') {
      updatePayload.closed_at = new Date().toISOString();
      updatePayload.closed_by = session.id;
    } else if (newStatus === 'reopened') {
      updatePayload.closed_at = null;
      updatePayload.closed_by = null;
    }

    // 4. Update
    const { data: updatedPeriod, error: updErr } = await supabase
      .from('tax_periods')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedPeriod) {
      console.error('[updateTaxPeriodStatusAction] Update error:', updErr);
      return { success: false, error: updErr?.message || 'Error al actualizar estado del periodo.' };
    }

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: newStatus === 'closed' ? 'CLOSE' : newStatus === 'reopened' ? 'REOPEN' : 'STATUS_CHANGE',
      entity_type: 'tax_period',
      entity_id: id,
      before_json: { status: period.status },
      after_json: { status: newStatus, notes: notes || null },
    });

    revalidatePath('/taxes/iva');

    const actionText =
      newStatus === 'closed'
        ? 'cerrado y congelado'
        : newStatus === 'reopened'
        ? 'reabierto'
        : newStatus === 'reviewed'
        ? 'marcado en revisión'
        : 'abierto';

    return {
      success: true,
      data: updatedPeriod,
      message: `Periodo fiscal ${actionText} exitosamente.`,
    };
  } catch (err: any) {
    console.error('[updateTaxPeriodStatusAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar periodo fiscal.' };
  }
}

/**
 * Adds a manual tax adjustment to an active (non-closed) tax period.
 * Restricted to SUPER_ADMIN, ADMIN, ACCOUNTANT.
 */
export async function addTaxAdjustmentAction(
  input: CreateTaxAdjustmentInput
): Promise<ActionResponse<TaxAdjustment>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!MANAGE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo Super Administradores, Administradores y Contadores pueden registrar ajustes de IVA.',
    };
  }

  const rawAmount = Number(input.amount);
  if (isNaN(rawAmount) || rawAmount === 0) {
    return { success: false, error: 'El monto del ajuste no puede ser cero.' };
  }
  const amount = roundHalfUp(Math.abs(rawAmount), 2);

  if (!input.reason || !input.reason.trim()) {
    return { success: false, error: 'Debe justificar el motivo del ajuste contable.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Verify period belongs to company and is NOT closed
    const { data: period, error: pErr } = await supabase
      .from('tax_periods')
      .select('*')
      .eq('id', input.tax_period_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (pErr || !period) {
      return { success: false, error: 'Periodo de impuestos no encontrado o no pertenece a su empresa.' };
    }

    if (period.status === 'closed') {
      return {
        success: false,
        error: 'No se pueden registrar ajustes en un periodo de IVA cerrado. Debe reabrir el periodo primero.',
      };
    }

    // 2. Insert adjustment record
    const { data: adjustment, error: adjInsErr } = await supabase
      .from('tax_adjustments')
      .insert({
        tax_period_id: period.id,
        adjustment_type: input.adjustment_type,
        amount: amount,
        reason: input.reason.trim(),
        document_id: input.document_id || null,
        created_by: session.id,
      })
      .select()
      .single();

    if (adjInsErr || !adjustment) {
      console.error('[addTaxAdjustmentAction] Insert error:', adjInsErr);
      return { success: false, error: adjInsErr?.message || 'Error al guardar el ajuste de IVA.' };
    }

    // 3. Recalculate adjustments on the period
    const { data: allAdjustments } = await supabase
      .from('tax_adjustments')
      .select('adjustment_type, amount')
      .eq('tax_period_id', period.id);

    let adjustmentsSum = 0;
    for (const a of allAdjustments || []) {
      adjustmentsSum += calculateAdjustmentDelta(a.adjustment_type, Number(a.amount));
    }
    adjustmentsSum = roundHalfUp(adjustmentsSum, 2);

    const newNetTax = calculateNetVat(
      Number(period.generated_tax),
      Number(period.deductible_tax),
      adjustmentsSum
    );

    // 4. Update period cached sums
    await supabase
      .from('tax_periods')
      .update({
        adjustments: adjustmentsSum,
        net_tax: newNetTax,
        updated_at: new Date().toISOString(),
      })
      .eq('id', period.id);

    // 5. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'tax_adjustment',
      entity_id: adjustment.id,
      before_json: null,
      after_json: {
        tax_period_id: period.id,
        adjustment_type: adjustment.adjustment_type,
        amount: adjustment.amount,
        reason: adjustment.reason,
      },
    });

    revalidatePath('/taxes/iva');

    return {
      success: true,
      data: adjustment,
      message: 'Ajuste de IVA registrado con éxito.',
    };
  } catch (err: any) {
    console.error('[addTaxAdjustmentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al registrar el ajuste.' };
  }
}
