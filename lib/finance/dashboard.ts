// ============================================================================
// Paguro Finance - Financial Dashboard Pure Calculation Engine
// Authoritative decimal math, period boundaries, and KPI aggregations
// ============================================================================

import {
  DashboardKpis,
  DashboardPeriod,
  DashboardRecentInvoice,
  DashboardRecentPurchase,
  DashboardRecentPayment,
} from '@/types/database';
import { roundHalfUp } from './calculations';
import { deriveProductStock, isLowStock } from './inventory';

/**
 * Helper to compute authoritative period boundaries in YYYY-MM-DD format
 */
export function getDashboardPeriodDates(
  period: DashboardPeriod,
  referenceDate: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  let start: Date;
  let end: Date;

  switch (period) {
    case 'quarter': {
      const qStartMonth = Math.floor(month / 3) * 3;
      start = new Date(year, qStartMonth, 1);
      end = new Date(year, qStartMonth + 3, 0);
      break;
    }
    case 'year': {
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      break;
    }
    case 'month':
    default: {
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
      break;
    }
  }

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    dateFrom: format(start),
    dateTo: format(end),
  };
}

export interface CalculateDashboardKpisInput {
  periodInvoices: Array<{ subtotal?: number | null; tax_total?: number | null; total?: number | null; balance_due?: number | null; status?: string | null }>;
  openInvoices: Array<{ balance_due?: number | null; status?: string | null }>;
  periodPurchases: Array<{ subtotal?: number | null; tax_total?: number | null; deductible_tax_total?: number | null; total?: number | null; balance_due?: number | null; status?: string | null }>;
  openPurchases: Array<{ balance_due?: number | null; status?: string | null }>;
  activeProducts: Array<{ id: string; cost?: number | null; stock_minimum?: number | null; is_inventory_item?: boolean | null }>;
  movements: Array<{ product_id: string; quantity_delta?: number | null }>;
}

/**
 * Computes all 7 authoritative dashboard financial KPIs
 */
export function calculateDashboardKpis(input: CalculateDashboardKpisInput): DashboardKpis {
  const {
    periodInvoices = [],
    openInvoices = [],
    periodPurchases = [],
    openPurchases = [],
    activeProducts = [],
    movements = [],
  } = input;

  const netSales = roundHalfUp(
    periodInvoices.reduce((acc, inv) => acc + (Number(inv.subtotal) || 0), 0)
  );
  const salesCount = periodInvoices.length;

  const totalExpenses = roundHalfUp(
    periodPurchases.reduce((acc, pur) => acc + (Number(pur.subtotal) || 0), 0)
  );
  const expensesCount = periodPurchases.length;

  const operatingMargin = roundHalfUp(netSales - totalExpenses);
  const operatingMarginPercent =
    netSales > 0 ? roundHalfUp((operatingMargin / netSales) * 100) : 0;

  const accountsReceivable = roundHalfUp(
    openInvoices.reduce((acc, inv) => acc + (Number(inv.balance_due) || 0), 0)
  );
  const openInvoicesCount = openInvoices.length;

  const accountsPayable = roundHalfUp(
    openPurchases.reduce((acc, pur) => acc + (Number(pur.balance_due) || 0), 0)
  );
  const openPurchasesCount = openPurchases.length;

  const generatedVat = roundHalfUp(
    periodInvoices.reduce((acc, inv) => acc + (Number(inv.tax_total) || 0), 0)
  );
  const deductibleVat = roundHalfUp(
    periodPurchases.reduce(
      (acc, pur) => acc + (Number(pur.deductible_tax_total) || Number(pur.tax_total) || 0),
      0
    )
  );
  const estimatedVatPayable = Math.max(0, roundHalfUp(generatedVat - deductibleVat));

  // Inventory Stock & Valuation Computation
  let inventoryValuation = 0;
  let trackedProductsCount = 0;
  let lowStockCount = 0;

  for (const product of activeProducts) {
    if (product.is_inventory_item) {
      trackedProductsCount += 1;
      const productMovements = movements.filter((m) => m.product_id === product.id);
      const stock = deriveProductStock(productMovements);
      const valuation = roundHalfUp(Math.max(0, stock) * (Number(product.cost) || 0));
      inventoryValuation = roundHalfUp(inventoryValuation + valuation);
      if (isLowStock(stock, Number(product.stock_minimum) || 0)) {
        lowStockCount += 1;
      }
    }
  }

  return {
    netSales,
    salesCount,
    totalExpenses,
    expensesCount,
    operatingMargin,
    operatingMarginPercent,
    accountsReceivable,
    openInvoicesCount,
    accountsPayable,
    openPurchasesCount,
    generatedVat,
    deductibleVat,
    estimatedVatPayable,
    inventoryValuation,
    trackedProductsCount,
    lowStockCount,
  };
}

/**
 * Formats recent sales records for dashboard rendering
 */
export function formatDashboardRecentSales(rawInvoices: any[]): DashboardRecentInvoice[] {
  return (rawInvoices || []).map((inv: any) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    issue_date: inv.issue_date,
    customer_name:
      inv.customer?.name || inv.customer?.trade_name || inv.customer?.legal_name || 'Cliente sin nombre',
    total: Number(inv.total) || 0,
    balance_due: Number(inv.balance_due) || 0,
    status: inv.status,
  }));
}

/**
 * Formats recent purchase records for dashboard rendering
 */
export function formatDashboardRecentPurchases(rawPurchases: any[]): DashboardRecentPurchase[] {
  return (rawPurchases || []).map((pur: any) => ({
    id: pur.id,
    document_number: pur.document_number,
    issue_date: pur.document_date || pur.issue_date || '',
    supplier_name:
      pur.supplier?.name || pur.supplier?.trade_name || pur.supplier?.legal_name || 'Proveedor sin nombre',
    category: pur.category || 'General',
    total: Number(pur.total) || 0,
    balance_due: Number(pur.balance_due) || 0,
    status: pur.status,
  }));
}

/**
 * Formats recent payment records for dashboard rendering
 */
export function formatDashboardRecentPayments(
  rawPayments: any[],
  counterpartyNamesMap?: Record<string, string>
): DashboardRecentPayment[] {
  return (rawPayments || []).map((pmt: any) => {
    let entityName = null;
    if (counterpartyNamesMap && pmt.counterparty_id) {
      entityName = counterpartyNamesMap[pmt.counterparty_id] || null;
    } else if (pmt.customer) {
      entityName = pmt.customer.name || pmt.customer.trade_name || pmt.customer.legal_name || null;
    } else if (pmt.supplier) {
      entityName = pmt.supplier.name || pmt.supplier.trade_name || pmt.supplier.legal_name || null;
    }

    return {
      id: pmt.id,
      payment_date: pmt.payment_date,
      direction: pmt.direction,
      method: pmt.method,
      reference: pmt.reference,
      amount: Number(pmt.amount) || 0,
      status: pmt.status,
      entity_name: entityName,
    };
  });
}
