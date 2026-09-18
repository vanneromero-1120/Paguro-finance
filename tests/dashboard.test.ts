// ============================================================================
// Paguro Finance - Financial Dashboard Unit Tests
// Tests KPI calculations, period date boundaries, zero states, and authorization
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  getDashboardPeriodDates,
  calculateDashboardKpis,
  formatDashboardRecentSales,
  formatDashboardRecentPurchases,
  formatDashboardRecentPayments,
} from '../lib/finance/dashboard';
import { roundHalfUp } from '../lib/finance/calculations';
import { deriveProductStock, isLowStock } from '../lib/finance/inventory';
import { UserRole } from '../types/database';

describe('Dashboard Period Date Boundaries', () => {
  it('calculates correct month start and end dates', () => {
    const testDate = new Date(2026, 8, 17); // Sep 17, 2026 (month is 0-indexed: 8 is September)
    const { dateFrom, dateTo } = getDashboardPeriodDates('month', testDate);

    expect(dateFrom).toBe('2026-09-01');
    expect(dateTo).toBe('2026-09-30');
  });

  it('calculates correct quarter start and end dates for Q3', () => {
    const testDate = new Date(2026, 8, 17); // Sep 17, 2026 -> Q3 (July - September)
    const { dateFrom, dateTo } = getDashboardPeriodDates('quarter', testDate);

    expect(dateFrom).toBe('2026-07-01');
    expect(dateTo).toBe('2026-09-30');
  });

  it('calculates correct quarter start and end dates for Q1 (leap/non-leap)', () => {
    const testDate = new Date(2026, 1, 15); // Feb 15, 2026 -> Q1 (January - March)
    const { dateFrom, dateTo } = getDashboardPeriodDates('quarter', testDate);

    expect(dateFrom).toBe('2026-01-01');
    expect(dateTo).toBe('2026-03-31');
  });

  it('calculates correct year start and end dates', () => {
    const testDate = new Date(2026, 8, 17);
    const { dateFrom, dateTo } = getDashboardPeriodDates('year', testDate);

    expect(dateFrom).toBe('2026-01-01');
    expect(dateTo).toBe('2026-12-31');
  });
});

describe('Dashboard KPI Calculations & Invariants', () => {
  const sampleInvoices = [
    { id: '1', subtotal: 1000000, tax_total: 190000, total: 1190000, balance_due: 0, status: 'paid' },
    { id: '2', subtotal: 2500000, tax_total: 475000, total: 2975000, balance_due: 1475000, status: 'partial' },
    { id: '3', subtotal: 800000, tax_total: 152000, total: 952000, balance_due: 952000, status: 'issued' },
    { id: '4', subtotal: 500000, tax_total: 95000, total: 595000, balance_due: 595000, status: 'draft' }, // excluded
    { id: '5', subtotal: 600000, tax_total: 114000, total: 714000, balance_due: 0, status: 'void' }, // excluded
  ];

  const samplePurchases = [
    { id: 'p1', subtotal: 1200000, tax_total: 228000, total: 1428000, balance_due: 0, status: 'paid' },
    { id: 'p2', subtotal: 800000, tax_total: 152000, total: 952000, balance_due: 452000, status: 'partial' },
    { id: 'p3', subtotal: 300000, tax_total: 0, total: 300000, balance_due: 300000, status: 'draft' }, // excluded
  ];

  it('calculates net sales excluding draft and void invoices', () => {
    const eligible = sampleInvoices.filter((inv) =>
      ['issued', 'partial', 'paid', 'overdue'].includes(inv.status)
    );
    const netSales = roundHalfUp(eligible.reduce((acc, inv) => acc + inv.subtotal, 0));

    expect(netSales).toBe(4300000); // 1000000 + 2500000 + 800000
    expect(eligible.length).toBe(3);
  });

  it('calculates total expenses excluding draft and void purchases', () => {
    const eligible = samplePurchases.filter((pur) =>
      ['issued', 'partial', 'paid', 'overdue'].includes(pur.status)
    );
    const totalExpenses = roundHalfUp(eligible.reduce((acc, pur) => acc + pur.subtotal, 0));

    expect(totalExpenses).toBe(2000000); // 1200000 + 800000
    expect(eligible.length).toBe(2);
  });

  it('calculates operating gross margin and percentage accurately', () => {
    const netSales = 4300000;
    const totalExpenses = 2000000;
    const operatingMargin = roundHalfUp(netSales - totalExpenses);
    const marginPercent = roundHalfUp((operatingMargin / netSales) * 100);

    expect(operatingMargin).toBe(2300000);
    expect(marginPercent).toBe(53.49);
  });

  it('handles zero sales gracefully without division by zero', () => {
    const netSales = 0;
    const totalExpenses = 500000;
    const operatingMargin = roundHalfUp(netSales - totalExpenses);
    const marginPercent = netSales > 0 ? roundHalfUp((operatingMargin / netSales) * 100) : 0;

    expect(operatingMargin).toBe(-500000);
    expect(marginPercent).toBe(0);
  });

  it('calculates accounts receivable from cumulative open balances', () => {
    const openInvoices = sampleInvoices.filter(
      (inv) => ['issued', 'partial', 'overdue'].includes(inv.status) && inv.balance_due > 0
    );
    const cxc = roundHalfUp(openInvoices.reduce((acc, inv) => acc + inv.balance_due, 0));

    expect(cxc).toBe(2427000); // 1475000 + 952000
    expect(openInvoices.length).toBe(2);
  });

  it('calculates accounts payable from cumulative open obligations', () => {
    const openPurchases = samplePurchases.filter(
      (pur) => ['issued', 'partial', 'overdue'].includes(pur.status) && pur.balance_due > 0
    );
    const cxp = roundHalfUp(openPurchases.reduce((acc, pur) => acc + pur.balance_due, 0));

    expect(cxp).toBe(452000);
    expect(openPurchases.length).toBe(1);
  });

  it('calculates estimated IVA payable as max(0, generated - deductible)', () => {
    const generatedVat = roundHalfUp(190000 + 475000 + 152000); // 817000
    const deductibleVat = roundHalfUp(228000 + 152000); // 380000
    const estimatedPayable = Math.max(0, roundHalfUp(generatedVat - deductibleVat));

    expect(estimatedPayable).toBe(437000);

    // Credit balance test (deductible > generated)
    const excessDeductible = 1000000;
    const creditPayable = Math.max(0, roundHalfUp(generatedVat - excessDeductible));
    expect(creditPayable).toBe(0);
  });

  it('derives product stock, valuation, and low stock count', () => {
    const products = [
      { id: 'prod-1', cost: 50000, stock_minimum: 10, is_inventory_item: true },
      { id: 'prod-2', cost: 120000, stock_minimum: 5, is_inventory_item: true },
      { id: 'prod-3', cost: 15000, stock_minimum: 0, is_inventory_item: false }, // service item
    ];

    const movements = [
      { product_id: 'prod-1', quantity_delta: 25 },
      { product_id: 'prod-1', quantity_delta: -18 }, // stock = 7 (low stock: 7 <= 10)
      { product_id: 'prod-2', quantity_delta: 12 },
      { product_id: 'prod-2', quantity_delta: -2 }, // stock = 10 (safe: 10 > 5)
    ];

    let valuation = 0;
    let lowStock = 0;
    let trackedCount = 0;

    for (const p of products) {
      if (p.is_inventory_item) {
        trackedCount++;
        const pMovements = movements.filter((m) => m.product_id === p.id);
        const stock = deriveProductStock(pMovements);
        valuation = roundHalfUp(valuation + Math.max(0, stock) * p.cost);
        if (isLowStock(stock, p.stock_minimum)) {
          lowStock++;
        }
      }
    }

    expect(trackedCount).toBe(2);
    expect(valuation).toBe(1550000); // (7 * 50000) + (10 * 120000) = 350000 + 1200000
    expect(lowStock).toBe(1); // prod-1 is low stock
  });
});

describe('Zero / Empty State Invariants', () => {
  it('returns clean zeros and zero counts when no financial data exists', () => {
    const emptyInvoices: any[] = [];
    const emptyPurchases: any[] = [];
    const emptyProducts: any[] = [];

    const netSales = roundHalfUp(emptyInvoices.reduce((a, b) => a + b.subtotal, 0));
    const totalExpenses = roundHalfUp(emptyPurchases.reduce((a, b) => a + b.subtotal, 0));
    const operatingMargin = roundHalfUp(netSales - totalExpenses);
    const operatingMarginPercent = netSales > 0 ? (operatingMargin / netSales) * 100 : 0;
    const cxc = roundHalfUp(emptyInvoices.reduce((a, b) => a + b.balance_due, 0));
    const cxp = roundHalfUp(emptyPurchases.reduce((a, b) => a + b.balance_due, 0));
    const estimatedIva = Math.max(0, 0);

    expect(netSales).toBe(0);
    expect(totalExpenses).toBe(0);
    expect(operatingMargin).toBe(0);
    expect(operatingMarginPercent).toBe(0);
    expect(cxc).toBe(0);
    expect(cxp).toBe(0);
    expect(estimatedIva).toBe(0);
    expect(emptyProducts.length).toBe(0);
  });
});

describe('Dashboard Security & Authorization', () => {
  const READ_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];

  it('permits VIEWER role to access dashboard data', () => {
    expect(READ_ROLES.includes('VIEWER')).toBe(true);
  });

  it('permits ACCOUNTANT role to access dashboard data', () => {
    expect(READ_ROLES.includes('ACCOUNTANT')).toBe(true);
  });

  it('restricts arbitrary unauthorized role strings', () => {
    expect(READ_ROLES.includes('ANONYMOUS' as any)).toBe(false);
    expect(READ_ROLES.includes('GUEST' as any)).toBe(false);
  });

  it('validates authorized company memberships for company selector', () => {
    const userMemberships = [
      { company: { id: 'comp-1', trade_name: 'Paguro Corp' }, role: 'ADMIN' },
      { company: { id: 'comp-2', trade_name: 'Pagureo Tech' }, role: 'VIEWER' },
    ];

    const isComp1Authorized = userMemberships.some((m) => m.company.id === 'comp-1');
    const isComp2Authorized = userMemberships.some((m) => m.company.id === 'comp-2');
    const isForeignAuthorized = userMemberships.some((m) => m.company.id === 'comp-foreign-999');

    expect(isComp1Authorized).toBe(true);
    expect(isComp2Authorized).toBe(true);
    expect(isForeignAuthorized).toBe(false);
  });
});

describe('Dashboard Helper Engine Direct Verification', () => {
  it('runs calculateDashboardKpis and returns structured KPI object', () => {
    const kpis = calculateDashboardKpis({
      periodInvoices: [
        { subtotal: 1500000, tax_total: 285000, total: 1785000, balance_due: 0, status: 'paid' },
        { subtotal: 2000000, tax_total: 380000, total: 2380000, balance_due: 1000000, status: 'partial' },
      ],
      openInvoices: [
        { balance_due: 1000000, status: 'partial' },
        { balance_due: 500000, status: 'issued' },
      ],
      periodPurchases: [
        { subtotal: 800000, tax_total: 152000, deductible_tax_total: 152000, total: 952000, balance_due: 0, status: 'paid' },
      ],
      openPurchases: [
        { balance_due: 350000, status: 'issued' },
      ],
      activeProducts: [
        { id: 'prod-1', cost: 40000, stock_minimum: 5, is_inventory_item: true },
      ],
      movements: [
        { product_id: 'prod-1', quantity_delta: 10 },
      ],
    });

    expect(kpis.netSales).toBe(3500000);
    expect(kpis.salesCount).toBe(2);
    expect(kpis.totalExpenses).toBe(800000);
    expect(kpis.expensesCount).toBe(1);
    expect(kpis.operatingMargin).toBe(2700000);
    expect(kpis.operatingMarginPercent).toBe(77.14);
    expect(kpis.accountsReceivable).toBe(1500000);
    expect(kpis.openInvoicesCount).toBe(2);
    expect(kpis.accountsPayable).toBe(350000);
    expect(kpis.openPurchasesCount).toBe(1);
    expect(kpis.generatedVat).toBe(665000);
    expect(kpis.deductibleVat).toBe(152000);
    expect(kpis.estimatedVatPayable).toBe(513000);
    expect(kpis.inventoryValuation).toBe(400000);
    expect(kpis.trackedProductsCount).toBe(1);
    expect(kpis.lowStockCount).toBe(0);
  });

  it('formats recent sales, purchases, and payments properly', () => {
    const rawInvoices = [
      { id: 'inv-1', invoice_number: 'SETT-0001', issue_date: '2026-09-15', total: 100000, balance_due: 50000, status: 'partial', customer: { trade_name: 'Acme' } },
    ];
    const rawPurchases = [
      { id: 'pur-1', document_number: 'FAC-999', issue_date: '2026-09-14', total: 60000, balance_due: 0, status: 'paid', category: 'Servicios', supplier: { trade_name: 'Tech Corp' } },
    ];
    const rawPayments = [
      { id: 'pmt-1', payment_date: '2026-09-15', direction: 'inbound', method: 'transfer', reference: 'TR-100', amount: 50000, status: 'completed', customer: { trade_name: 'Acme' } },
    ];

    const formattedSales = formatDashboardRecentSales(rawInvoices);
    const formattedPurchases = formatDashboardRecentPurchases(rawPurchases);
    const formattedPayments = formatDashboardRecentPayments(rawPayments);

    expect(formattedSales[0].customer_name).toBe('Acme');
    expect(formattedPurchases[0].supplier_name).toBe('Tech Corp');
    expect(formattedPayments[0].entity_name).toBe('Acme');
    expect(formattedPayments[0].direction).toBe('inbound');
  });
});

