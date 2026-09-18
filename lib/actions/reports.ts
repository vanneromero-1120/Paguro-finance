// ============================================================================
// Paguro Finance - Financial Reports Server Actions
// Real Supabase data, Multi-company isolated, RLS-enforced, Audit logging
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  ReportType,
  ReportFilterInput,
  SalesReportData,
  ExpensesReportData,
  AccountsReceivableReportData,
  AccountsPayableReportData,
  IvaReportData,
  InventoryReportData,
  CustomerBalancesReportData,
  SupplierBalancesReportData,
  ProductProfitabilityReportData,
} from '@/types/database';
import { roundHalfUp } from '@/lib/finance/calculations';
import { deriveProductStock, isLowStock, calculateInventoryValuation } from '@/lib/finance/inventory';
import {
  calculateAgingBucket,
  aggregateReceivableAging,
  aggregatePayableAging,
  calculateProfitability,
  generateCsv,
} from '@/lib/finance/reports';
import { calculateNetVat, calculateAdjustmentDelta } from '@/lib/finance/taxes';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];

/**
 * 1. Sales by Period Report
 */
export async function getSalesReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<SalesReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar reportes.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    let query = supabase
      .from('sales_invoices')
      .select('id, invoice_number, customer_id, issue_date, due_date, subtotal, tax_total, total, paid_total, balance_due, status, customers(name, tax_id)')
      .eq('company_id', session.activeCompanyId)
      .order('issue_date', { ascending: false });

    if (filters?.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.customer_id && filters.customer_id !== 'all') {
      query = query.eq('customer_id', filters.customer_id);
    }

    const { data: invoices, error } = await query;
    if (error) {
      console.error('[getSalesReportAction] Query error:', error);
      return { success: false, error: 'Error al consultar reporte de ventas.' };
    }

    let totalInvoiced = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalCollected = 0;
    let totalBalanceDue = 0;

    const items = (invoices || []).map((inv: any) => {
      const sub = Number(inv.subtotal) || 0;
      const tax = Number(inv.tax_total) || 0;
      const tot = Number(inv.total) || 0;
      const paid = Number(inv.paid_total) || 0;
      const bal = Number(inv.balance_due) || 0;

      totalInvoiced += tot;
      totalSubtotal += sub;
      totalTax += tax;
      totalCollected += paid;
      totalBalanceDue += bal;

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customers?.name || 'Cliente sin nombre',
        customer_tax_id: inv.customers?.tax_id || '',
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        subtotal: roundHalfUp(sub, 2),
        tax_total: roundHalfUp(tax, 2),
        total: roundHalfUp(tot, 2),
        paid_amount: roundHalfUp(paid, 2),
        balance_due: roundHalfUp(bal, 2),
        status: inv.status,
      };
    });

    return {
      success: true,
      data: {
        summary: {
          total_invoiced: roundHalfUp(totalInvoiced, 2),
          total_subtotal: roundHalfUp(totalSubtotal, 2),
          total_tax: roundHalfUp(totalTax, 2),
          total_collected: roundHalfUp(totalCollected, 2),
          total_balance_due: roundHalfUp(totalBalanceDue, 2),
          invoice_count: items.length,
        },
        items,
      },
    };
  } catch (err: any) {
    console.error('[getSalesReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 2. Expenses / Purchases by Period Report
 */
export async function getExpensesReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<ExpensesReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar reportes.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    let query = supabase
      .from('purchase_documents')
      .select('id, document_number, supplier_id, category, document_date, due_date, subtotal, deductible_tax_total, total, paid_total, balance_due, status, suppliers(name, tax_id)')
      .eq('company_id', session.activeCompanyId)
      .order('document_date', { ascending: false });

    if (filters?.date_from) {
      query = query.gte('document_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('document_date', filters.date_to);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.supplier_id && filters.supplier_id !== 'all') {
      query = query.eq('supplier_id', filters.supplier_id);
    }
    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    const { data: purchases, error } = await query;
    if (error) {
      console.error('[getExpensesReportAction] Query error:', error);
      return { success: false, error: 'Error al consultar reporte de gastos.' };
    }

    let totalExpenses = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;

    const categoryTotals = new Map<string, { total: number; count: number }>();

    const items = (purchases || []).map((p: any) => {
      const sub = Number(p.subtotal) || 0;
      const tax = Number(p.deductible_tax_total) || 0;
      const tot = Number(p.total) || 0;
      const paid = Number(p.paid_total) || 0;
      const bal = Number(p.balance_due) || 0;
      const cat = p.category || 'general';

      totalExpenses += tot;
      totalSubtotal += sub;
      totalTax += tax;
      totalPaid += paid;
      totalBalanceDue += bal;

      const catEntry = categoryTotals.get(cat) || { total: 0, count: 0 };
      catEntry.total += tot;
      catEntry.count += 1;
      categoryTotals.set(cat, catEntry);

      return {
        id: p.id,
        document_number: p.document_number,
        supplier_name: p.suppliers?.name || 'Proveedor sin nombre',
        supplier_tax_id: p.suppliers?.tax_id || '',
        category: cat,
        document_date: p.document_date,
        due_date: p.due_date || p.document_date,
        subtotal: roundHalfUp(sub, 2),
        tax_total: roundHalfUp(tax, 2),
        total: roundHalfUp(tot, 2),
        paid_amount: roundHalfUp(paid, 2),
        balance_due: roundHalfUp(bal, 2),
        status: p.status,
      };
    });

    const by_category = Array.from(categoryTotals.entries()).map(([category, stats]) => ({
      category,
      total: roundHalfUp(stats.total, 2),
      count: stats.count,
    }));

    return {
      success: true,
      data: {
        summary: {
          total_expenses: roundHalfUp(totalExpenses, 2),
          total_subtotal: roundHalfUp(totalSubtotal, 2),
          total_tax: roundHalfUp(totalTax, 2),
          total_paid: roundHalfUp(totalPaid, 2),
          total_balance_due: roundHalfUp(totalBalanceDue, 2),
          document_count: items.length,
        },
        items,
        by_category,
      },
    };
  } catch (err: any) {
    console.error('[getExpensesReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 3. Accounts Receivable (A/R / Cartera / CxC) with Aging Buckets
 */
export async function getAccountsReceivableReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<AccountsReceivableReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar cartera.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    let query = supabase
      .from('sales_invoices')
      .select('id, invoice_number, customer_id, issue_date, due_date, total, paid_total, balance_due, status, customers(id, name, tax_id)')
      .eq('company_id', session.activeCompanyId)
      .gt('balance_due', 0)
      .order('due_date', { ascending: true });

    if (filters?.customer_id && filters.customer_id !== 'all') {
      query = query.eq('customer_id', filters.customer_id);
    }
    if (filters?.date_from) {
      query = query.gte('issue_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('issue_date', filters.date_to);
    }

    const { data: invoices, error } = await query;
    if (error) {
      console.error('[getAccountsReceivableReportAction] Error:', error);
      return { success: false, error: 'Error al consultar cartera de clientes.' };
    }

    const allItems = (invoices || []).map((inv: any) => {
      const { daysOverdue, bucket } = calculateAgingBucket(inv.due_date);
      return {
        id: inv.id,
        customer_id: inv.customer_id,
        customer_name: inv.customers?.name || 'Cliente sin nombre',
        customer_tax_id: inv.customers?.tax_id || '',
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        total: roundHalfUp(Number(inv.total) || 0, 2),
        paid_amount: roundHalfUp(Number(inv.paid_total) || 0, 2),
        balance_due: roundHalfUp(Number(inv.balance_due) || 0, 2),
        status: inv.status,
        days_overdue: daysOverdue,
        aging_bucket: bucket,
      };
    });

    const filteredItems = filters?.aging_bucket && filters.aging_bucket !== 'all'
      ? allItems.filter((i) => i.aging_bucket === filters.aging_bucket)
      : allItems;

    const summary = aggregateReceivableAging(allItems);

    return {
      success: true,
      data: {
        summary,
        items: filteredItems,
      },
    };
  } catch (err: any) {
    console.error('[getAccountsReceivableReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 4. Accounts Payable (A/P / Cuentas por Pagar / CxP) with Aging Buckets
 */
export async function getAccountsPayableReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<AccountsPayableReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar cuentas por pagar.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    let query = supabase
      .from('purchase_documents')
      .select('id, document_number, supplier_id, document_date, due_date, total, paid_total, balance_due, status, suppliers(id, name, tax_id)')
      .eq('company_id', session.activeCompanyId)
      .gt('balance_due', 0)
      .order('due_date', { ascending: true });

    if (filters?.supplier_id && filters.supplier_id !== 'all') {
      query = query.eq('supplier_id', filters.supplier_id);
    }
    if (filters?.date_from) {
      query = query.gte('document_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('document_date', filters.date_to);
    }

    const { data: purchases, error } = await query;
    if (error) {
      console.error('[getAccountsPayableReportAction] Error:', error);
      return { success: false, error: 'Error al consultar cuentas por pagar.' };
    }

    const allItems = (purchases || []).map((p: any) => {
      const effectiveDue = p.due_date || p.document_date;
      const { daysOverdue, bucket } = calculateAgingBucket(effectiveDue);
      return {
        id: p.id,
        supplier_id: p.supplier_id,
        supplier_name: p.suppliers?.name || 'Proveedor sin nombre',
        supplier_tax_id: p.suppliers?.tax_id || '',
        document_number: p.document_number,
        document_date: p.document_date,
        due_date: effectiveDue,
        total: roundHalfUp(Number(p.total) || 0, 2),
        paid_amount: roundHalfUp(Number(p.paid_total) || 0, 2),
        balance_due: roundHalfUp(Number(p.balance_due) || 0, 2),
        status: p.status,
        days_overdue: daysOverdue,
        aging_bucket: bucket,
      };
    });

    const filteredItems = filters?.aging_bucket && filters.aging_bucket !== 'all'
      ? allItems.filter((i) => i.aging_bucket === filters.aging_bucket)
      : allItems;

    const summary = aggregatePayableAging(allItems);

    return {
      success: true,
      data: {
        summary,
        items: filteredItems,
      },
    };
  } catch (err: any) {
    console.error('[getAccountsPayableReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 5. IVA Summary Report
 */
export async function getIvaReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<IvaReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar reporte de IVA.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    let periodsQuery = supabase
      .from('tax_periods')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('period_start', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      periodsQuery = periodsQuery.eq('status', filters.status);
    }

    const { data: periods, error: pErr } = await periodsQuery;
    if (pErr) {
      return { success: false, error: 'Error al consultar periodos tributarios.' };
    }

    let totalSalesVat = 0;
    let totalPurchasesVat = 0;
    let totalAdjustments = 0;
    let totalEstimatedPayable = 0;

    const items = await Promise.all(
      (periods || []).map(async (tp) => {
        // Fetch matching sales invoices
        const { data: sales } = await supabase
          .from('sales_invoices')
          .select('tax_total')
          .eq('company_id', session.activeCompanyId)
          .in('status', ['issued', 'partial', 'paid'])
          .gte('issue_date', tp.period_start)
          .lte('issue_date', tp.period_end);

        // Fetch matching purchase documents
        const { data: purchases } = await supabase
          .from('purchase_documents')
          .select('deductible_tax_total')
          .eq('company_id', session.activeCompanyId)
          .in('status', ['open', 'partial', 'paid'])
          .gte('document_date', tp.period_start)
          .lte('document_date', tp.period_end);

        // Fetch adjustments
        const { data: adjustments } = await supabase
          .from('tax_adjustments')
          .select('adjustment_type, amount')
          .eq('tax_period_id', tp.id);

        const salesVat = roundHalfUp(
          (sales || []).reduce((acc, s) => acc + (Number(s.tax_total) || 0), 0),
          2
        );
        const purchasesVat = roundHalfUp(
          (purchases || []).reduce((acc, p) => acc + (Number(p.deductible_tax_total) || 0), 0),
          2
        );

        let adjDelta = 0;
        (adjustments || []).forEach((adj) => {
          adjDelta += calculateAdjustmentDelta(adj.adjustment_type as any, Number(adj.amount) || 0);
        });
        adjDelta = roundHalfUp(adjDelta, 2);

        const netVat = calculateNetVat(salesVat, purchasesVat, adjDelta);

        totalSalesVat += salesVat;
        totalPurchasesVat += purchasesVat;
        totalAdjustments += adjDelta;
        totalEstimatedPayable += netVat;

        return {
          period_id: tp.id,
          period_name: `Periodo ${tp.tax_type} (${tp.period_start} - ${tp.period_end})`,
          start_date: tp.period_start,
          end_date: tp.period_end,
          status: tp.status,
          sales_vat: salesVat,
          purchases_vat: purchasesVat,
          adjustments_total: adjDelta,
          net_vat: netVat,
        };
      })
    );

    return {
      success: true,
      data: {
        summary: {
          total_sales_vat: roundHalfUp(totalSalesVat, 2),
          total_purchases_vat: roundHalfUp(totalPurchasesVat, 2),
          total_adjustments: roundHalfUp(totalAdjustments, 2),
          estimated_vat_payable: roundHalfUp(totalEstimatedPayable, 2),
        },
        items,
      },
    };
  } catch (err: any) {
    console.error('[getIvaReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 6. Inventory Status and Valuation Report
 */
export async function getInventoryReportAction(
  filters?: ReportFilterInput
): Promise<ActionResponse<InventoryReportData>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar inventario.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('id, sku, name, cost, sale_price, stock_minimum, status, category')
      .eq('company_id', session.activeCompanyId)
      .eq('status', 'active')
      .order('sku', { ascending: true });

    if (pErr) {
      return { success: false, error: 'Error al consultar productos.' };
    }

    const { data: movements, error: mErr } = await supabase
      .from('inventory_movements')
      .select('product_id, quantity_delta')
      .eq('company_id', session.activeCompanyId);

    if (mErr) {
      return { success: false, error: 'Error al consultar movimientos de inventario.' };
    }

    // Group movements by product_id
    const movementsByProduct = new Map<string, any[]>();
    (movements || []).forEach((m) => {
      const list = movementsByProduct.get(m.product_id) || [];
      list.push(m);
      movementsByProduct.set(m.product_id, list);
    });

    let totalUnits = 0;
    let totalValuation = 0;
    let lowStockCount = 0;

    const items = (products || []).map((prod: any) => {
      const prodMoves = movementsByProduct.get(prod.id) || [];
      const currentStock = deriveProductStock(prodMoves);
      const unitCost = Number(prod.cost) || 0;
      const unitPrice = Number(prod.sale_price) || 0;
      const minStock = Number(prod.stock_minimum) || 0;
      const val = calculateInventoryValuation(currentStock, unitCost);
      const low = isLowStock(currentStock, minStock);

      totalUnits += currentStock;
      totalValuation += val;
      if (low) lowStockCount += 1;

      return {
        id: prod.id,
        sku: prod.sku,
        name: prod.name,
        category_name: prod.category || 'General',
        current_stock: currentStock,
        minimum_stock: minStock,
        unit_cost: roundHalfUp(unitCost, 2),
        unit_price: roundHalfUp(unitPrice, 2),
        valuation: val,
        is_low_stock: low,
      };
    });

    return {
      success: true,
      data: {
        summary: {
          total_skus: items.length,
          total_units: roundHalfUp(totalUnits, 4),
          total_valuation: roundHalfUp(totalValuation, 2),
          low_stock_count: lowStockCount,
        },
        items,
      },
    };
  } catch (err: any) {
    console.error('[getInventoryReportAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado.' };
  }
}

/**
 * 7. Customer Balances Report
 */
export async function getCustomerBalancesReportAction(): Promise<ActionResponse<CustomerBalancesReportData>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };
  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, tax_id')
      .eq('company_id', session.activeCompanyId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    const { data: invoices } = await supabase
      .from('sales_invoices')
      .select('customer_id, total, paid_total, balance_due')
      .eq('company_id', session.activeCompanyId);

    const invoicesByCust = new Map<string, { invoiced: number; paid: number; balance: number; open: number }>();
    (invoices || []).forEach((inv) => {
      const entry = invoicesByCust.get(inv.customer_id) || { invoiced: 0, paid: 0, balance: 0, open: 0 };
      entry.invoiced += Number(inv.total) || 0;
      entry.paid += Number(inv.paid_total) || 0;
      entry.balance += Number(inv.balance_due) || 0;
      if (Number(inv.balance_due) > 0) entry.open += 1;
      invoicesByCust.set(inv.customer_id, entry);
    });

    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    const items = (customers || []).map((c) => {
      const stats = invoicesByCust.get(c.id) || { invoiced: 0, paid: 0, balance: 0, open: 0 };
      totalInvoiced += stats.invoiced;
      totalCollected += stats.paid;
      totalOutstanding += stats.balance;

      return {
        customer_id: c.id,
        customer_name: c.name,
        customer_tax_id: c.tax_id || '',
        total_invoiced: roundHalfUp(stats.invoiced, 2),
        total_paid: roundHalfUp(stats.paid, 2),
        current_balance: roundHalfUp(stats.balance, 2),
        open_invoices_count: stats.open,
      };
    });

    return {
      success: true,
      data: {
        summary: {
          total_customers: items.length,
          total_invoiced: roundHalfUp(totalInvoiced, 2),
          total_collected: roundHalfUp(totalCollected, 2),
          total_outstanding: roundHalfUp(totalOutstanding, 2),
        },
        items,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 8. Supplier Balances Report
 */
export async function getSupplierBalancesReportAction(): Promise<ActionResponse<SupplierBalancesReportData>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };
  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, tax_id')
      .eq('company_id', session.activeCompanyId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    const { data: purchases } = await supabase
      .from('purchase_documents')
      .select('supplier_id, total, paid_total, balance_due')
      .eq('company_id', session.activeCompanyId);

    const purchasesBySupp = new Map<string, { billed: number; paid: number; balance: number; open: number }>();
    (purchases || []).forEach((p) => {
      const entry = purchasesBySupp.get(p.supplier_id) || { billed: 0, paid: 0, balance: 0, open: 0 };
      entry.billed += Number(p.total) || 0;
      entry.paid += Number(p.paid_total) || 0;
      entry.balance += Number(p.balance_due) || 0;
      if (Number(p.balance_due) > 0) entry.open += 1;
      purchasesBySupp.set(p.supplier_id, entry);
    });

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const items = (suppliers || []).map((s) => {
      const stats = purchasesBySupp.get(s.id) || { billed: 0, paid: 0, balance: 0, open: 0 };
      totalBilled += stats.billed;
      totalPaid += stats.paid;
      totalOutstanding += stats.balance;

      return {
        supplier_id: s.id,
        supplier_name: s.name,
        supplier_tax_id: s.tax_id || '',
        total_billed: roundHalfUp(stats.billed, 2),
        total_paid: roundHalfUp(stats.paid, 2),
        current_balance: roundHalfUp(stats.balance, 2),
        open_bills_count: stats.open,
      };
    });

    return {
      success: true,
      data: {
        summary: {
          total_suppliers: items.length,
          total_billed: roundHalfUp(totalBilled, 2),
          total_paid: roundHalfUp(totalPaid, 2),
          total_outstanding: roundHalfUp(totalOutstanding, 2),
        },
        items,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 9. Product Profitability Report
 */
export async function getProductProfitabilityReportAction(): Promise<ActionResponse<ProductProfitabilityReportData>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };
  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, cost')
      .eq('company_id', session.activeCompanyId);

    const { data: invoiceItems } = await supabase
      .from('sales_invoice_items')
      .select('product_id, quantity, unit_price, discount_amount, sales_invoices(company_id, status)')
      .eq('sales_invoices.company_id', session.activeCompanyId)
      .in('sales_invoices.status', ['issued', 'partial', 'paid']);

    const salesByProd = new Map<string, { qty: number; revenue: number }>();
    (invoiceItems || []).forEach((item: any) => {
      if (!item.product_id || !item.sales_invoices) return;
      const entry = salesByProd.get(item.product_id) || { qty: 0, revenue: 0 };
      const q = Number(item.quantity) || 0;
      const up = Number(item.unit_price) || 0;
      const d = Number(item.discount_amount) || 0;
      entry.qty += q;
      entry.revenue += Math.max(0, q * up - d);
      salesByProd.set(item.product_id, entry);
    });

    let totalSold = 0;
    let totalRev = 0;
    let totalCogs = 0;

    const items = (products || []).map((p) => {
      const stats = salesByProd.get(p.id) || { qty: 0, revenue: 0 };
      const cost = Number(p.cost) || 0;
      const cogs = roundHalfUp(stats.qty * cost, 2);
      const rev = roundHalfUp(stats.revenue, 2);
      const { grossProfit, grossMarginPct } = calculateProfitability(rev, cogs);

      totalSold += stats.qty;
      totalRev += rev;
      totalCogs += cogs;

      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        units_sold: stats.qty,
        revenue: rev,
        cogs,
        gross_profit: grossProfit,
        gross_margin_pct: grossMarginPct,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const totalGross = roundHalfUp(totalRev - totalCogs, 2);
    const overallMargin = totalRev > 0 ? roundHalfUp((totalGross / totalRev) * 100, 2) : 0;

    return {
      success: true,
      data: {
        summary: {
          total_units_sold: roundHalfUp(totalSold, 2),
          total_revenue: roundHalfUp(totalRev, 2),
          total_cogs: roundHalfUp(totalCogs, 2),
          total_gross_profit: totalGross,
          overall_margin_pct: overallMargin,
        },
        items,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 10. Export Report to CSV with Audit Logging
 */
export async function exportReportCsvAction(
  reportType: ReportType,
  filters?: ReportFilterInput
): Promise<ActionResponse<{ csv_content: string; filename: string }>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    let headers: string[] = [];
    let rows: (string | number | boolean | null | undefined)[][] = [];
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `reporte_${reportType}_${session.activeCompanyId.slice(0, 8)}_${dateStamp}.csv`;

    switch (reportType) {
      case 'sales': {
        const res = await getSalesReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar ventas.' };
        headers = ['Factura', 'Cliente', 'NIT', 'Fecha Emision', 'Vencimiento', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Saldo', 'Estado'];
        rows = res.data.items.map((i) => [
          i.invoice_number,
          i.customer_name,
          i.customer_tax_id,
          i.issue_date,
          i.due_date,
          i.subtotal,
          i.tax_total,
          i.total,
          i.paid_amount,
          i.balance_due,
          i.status,
        ]);
        break;
      }
      case 'expenses': {
        const res = await getExpensesReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar gastos.' };
        headers = ['Documento', 'Proveedor', 'NIT', 'Categoria', 'Fecha', 'Vencimiento', 'Subtotal', 'IVA Descontable', 'Total', 'Pagado', 'Saldo', 'Estado'];
        rows = res.data.items.map((p) => [
          p.document_number,
          p.supplier_name,
          p.supplier_tax_id,
          p.category,
          p.document_date,
          p.due_date,
          p.subtotal,
          p.tax_total,
          p.total,
          p.paid_amount,
          p.balance_due,
          p.status,
        ]);
        break;
      }
      case 'cxc': {
        const res = await getAccountsReceivableReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar cartera.' };
        headers = ['Cliente', 'NIT', 'Factura', 'Emision', 'Vencimiento', 'Dias Vencido', 'Tramo', 'Total', 'Pagado', 'Saldo Pendiente'];
        rows = res.data.items.map((i) => [
          i.customer_name,
          i.customer_tax_id,
          i.invoice_number,
          i.issue_date,
          i.due_date,
          i.days_overdue,
          i.aging_bucket,
          i.total,
          i.paid_amount,
          i.balance_due,
        ]);
        break;
      }
      case 'cxp': {
        const res = await getAccountsPayableReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar cuentas por pagar.' };
        headers = ['Proveedor', 'NIT', 'Documento', 'Fecha', 'Vencimiento', 'Dias Vencido', 'Tramo', 'Total', 'Pagado', 'Saldo Pendiente'];
        rows = res.data.items.map((p) => [
          p.supplier_name,
          p.supplier_tax_id,
          p.document_number,
          p.document_date,
          p.due_date,
          p.days_overdue,
          p.aging_bucket,
          p.total,
          p.paid_amount,
          p.balance_due,
        ]);
        break;
      }
      case 'iva': {
        const res = await getIvaReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar IVA.' };
        headers = ['Periodo', 'Inicio', 'Fin', 'Estado', 'IVA Generado', 'IVA Descontable', 'Ajustes Netos', 'IVA a Pagar Estimado'];
        rows = res.data.items.map((i) => [
          i.period_name,
          i.start_date,
          i.end_date,
          i.status,
          i.sales_vat,
          i.purchases_vat,
          i.adjustments_total,
          i.net_vat,
        ]);
        break;
      }
      case 'inventory': {
        const res = await getInventoryReportAction(filters);
        if (!res.success || !res.data) return { success: false, error: res.error || 'Error al exportar inventario.' };
        headers = ['SKU', 'Producto', 'Categoria', 'Stock Actual', 'Stock Minimo', 'Costo Unitario', 'Precio Venta', 'Valoracion Total', 'Bajo Stock'];
        rows = res.data.items.map((i) => [
          i.sku,
          i.name,
          i.category_name,
          i.current_stock,
          i.minimum_stock,
          i.unit_cost,
          i.unit_price,
          i.valuation,
          i.is_low_stock ? 'SI' : 'NO',
        ]);
        break;
      }
      case 'customer_balances': {
        const res = await getCustomerBalancesReportAction();
        if (!res.success || !res.data) return { success: false, error: 'Error al exportar saldos clientes.' };
        headers = ['Cliente', 'NIT', 'Total Facturado', 'Total Recaudado', 'Saldo Pendiente', 'Facturas Abiertas'];
        rows = res.data.items.map((c) => [
          c.customer_name,
          c.customer_tax_id,
          c.total_invoiced,
          c.total_paid,
          c.current_balance,
          c.open_invoices_count,
        ]);
        break;
      }
      case 'supplier_balances': {
        const res = await getSupplierBalancesReportAction();
        if (!res.success || !res.data) return { success: false, error: 'Error al exportar saldos proveedores.' };
        headers = ['Proveedor', 'NIT', 'Total Facturado', 'Total Pagado', 'Saldo Pendiente', 'Facturas Abiertas'];
        rows = res.data.items.map((s) => [
          s.supplier_name,
          s.supplier_tax_id,
          s.total_billed,
          s.total_paid,
          s.current_balance,
          s.open_bills_count,
        ]);
        break;
      }
      case 'profitability': {
        const res = await getProductProfitabilityReportAction();
        if (!res.success || !res.data) return { success: false, error: 'Error al exportar rentabilidad.' };
        headers = ['SKU', 'Producto', 'Unidades Vendidas', 'Ingresos Ventas', 'Costo Mercancia (COGS)', 'Margen Bruto ($)', 'Margen Bruto (%)'];
        rows = res.data.items.map((p) => [
          p.sku,
          p.name,
          p.units_sold,
          p.revenue,
          p.cogs,
          p.gross_profit,
          `${p.gross_margin_pct}%`,
        ]);
        break;
      }
      default:
        return { success: false, error: 'Tipo de reporte desconocido.' };
    }

    const csvContent = generateCsv(headers, rows);

    // Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'REPORT_EXPORT',
      entity_type: 'report',
      entity_id: session.activeCompanyId,
      after_json: {
        report_type: reportType,
        record_count: rows.length,
        filters,
      },
    });

    return {
      success: true,
      data: {
        csv_content: csvContent,
        filename,
      },
    };
  } catch (err: any) {
    console.error('[exportReportCsvAction] Exception:', err);
    return { success: false, error: err.message || 'Error inesperado durante la exportación.' };
  }
}
