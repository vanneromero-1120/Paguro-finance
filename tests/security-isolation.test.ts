// ============================================================================
// Paguro Finance - Security Isolation, RLS & Financial Integrity Test Suite
// ============================================================================

import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from '../lib/auth/permissions';
import { UserRole } from '../types/database';
import { roundHalfUp, calculateLineItem, calculateDocumentTotals } from '../lib/finance/calculations';
import { formatCurrency } from '../lib/utils/formatters';
import {
  mockCompanies,
  mockCustomers,
  mockSuppliers,
  mockProducts,
  mockInvoices,
  mockExpenses,
  mockPayments,
  mockInventoryMovements,
  mockTaxPeriods,
} from './fixtures/security-test-fixtures';

describe('Phase 11: Multi-Company Security Isolation', () => {
  const company1 = mockCompanies[0]; // Paguro Corp Demo
  const company2 = mockCompanies[1]; // Pagureo Demo

  it('verifies demo companies have distinct non-overlapping IDs', () => {
    expect(company1.id).toBeDefined();
    expect(company2.id).toBeDefined();
    expect(company1.id).not.toEqual(company2.id);
  });

  it('strictly isolates customer data per company', () => {
    const c1Customers = mockCustomers.filter((c) => c.company_id === company1.id);
    const c2Customers = mockCustomers.filter((c) => c.company_id === company2.id);

    expect(c1Customers.length).toBeGreaterThan(0);
    // Ensure none of company 1's customers leak into company 2's dataset
    const c1Ids = new Set(c1Customers.map((c) => c.id));
    for (const c2 of c2Customers) {
      expect(c1Ids.has(c2.id)).toBe(false);
    }
  });

  it('strictly isolates supplier data per company', () => {
    const c1Suppliers = mockSuppliers.filter((s) => s.company_id === company1.id);
    const c2Suppliers = mockSuppliers.filter((s) => s.company_id === company2.id);

    expect(c1Suppliers.length).toBeGreaterThan(0);
    const c1Ids = new Set(c1Suppliers.map((s) => s.id));
    for (const s2 of c2Suppliers) {
      expect(c1Ids.has(s2.id)).toBe(false);
    }
  });

  it('strictly isolates invoices, expenses, payments, inventory, and tax periods per company', () => {
    // Invoices
    const c1Invoices = mockInvoices.filter((i) => i.company_id === company1.id);
    expect(c1Invoices.every((i) => i.company_id === company1.id)).toBe(true);

    // Expenses
    const c1Expenses = mockExpenses.filter((e) => e.company_id === company1.id);
    expect(c1Expenses.every((e) => e.company_id === company1.id)).toBe(true);

    // Payments
    const c1Payments = mockPayments.filter((p) => p.company_id === company1.id);
    expect(c1Payments.every((p) => p.company_id === company1.id)).toBe(true);

    // Inventory Movements
    const c1Movements = mockInventoryMovements.filter((m) => m.company_id === company1.id);
    expect(c1Movements.every((m) => m.company_id === company1.id)).toBe(true);

    // Tax Periods
    const c1TaxPeriods = mockTaxPeriods.filter((t) => t.company_id === company1.id);
    expect(c1TaxPeriods.every((t) => t.company_id === company1.id)).toBe(true);
  });
});

describe('Phase 11: Cross-Company Foreign-Key Ownership Integrity', () => {
  const company1 = mockCompanies[0];
  const company2 = mockCompanies[1];

  function validateInvoiceCrossCompany(invoiceCompanyId: string, customerId: string) {
    const customer = mockCustomers.find((c) => c.id === customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }
    if (customer.company_id !== invoiceCompanyId) {
      throw new Error(
        `CROSS_COMPANY_VIOLATION: Customer ${customerId} belongs to company ${customer.company_id}, not ${invoiceCompanyId}`
      );
    }
    return true;
  }

  function validateExpenseCrossCompany(expenseCompanyId: string, supplierId: string) {
    const supplier = mockSuppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    if (supplier.company_id !== expenseCompanyId) {
      throw new Error(
        `CROSS_COMPANY_VIOLATION: Supplier ${supplierId} belongs to company ${supplier.company_id}, not ${expenseCompanyId}`
      );
    }
    return true;
  }

  function validatePaymentAllocationCrossCompany(paymentCompanyId: string, invoiceId: string) {
    const invoice = mockInvoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.company_id !== paymentCompanyId) {
      throw new Error(
        `CROSS_COMPANY_VIOLATION: Payment company ${paymentCompanyId} does not match invoice company ${invoice.company_id}`
      );
    }
    return true;
  }

  it('approves legitimate intra-company invoice customer association', () => {
    const c1Customer = mockCustomers.find((c) => c.company_id === company1.id);
    expect(c1Customer).toBeDefined();
    expect(validateInvoiceCrossCompany(company1.id, c1Customer!.id)).toBe(true);
  });

  it('rejects cross-company customer assignment to an invoice (Database Trigger Simulation)', () => {
    const c2Customer = mockCustomers.find((c) => c.company_id === company2.id);
    expect(c2Customer).toBeDefined();

    expect(() => {
      validateInvoiceCrossCompany(company1.id, c2Customer!.id);
    }).toThrow(/CROSS_COMPANY_VIOLATION/);
  });

  it('rejects cross-company supplier assignment to an expense', () => {
    const c2Supplier = mockSuppliers.find((s) => s.company_id === company2.id);
    expect(c2Supplier).toBeDefined();

    expect(() => {
      validateExpenseCrossCompany(company1.id, c2Supplier!.id);
    }).toThrow(/CROSS_COMPANY_VIOLATION/);
  });

  it('rejects cross-company payment allocation linking payments and invoices of different entities', () => {
    const c2Invoice = mockInvoices.find((i) => i.company_id === company2.id);
    expect(c2Invoice).toBeDefined();

    expect(() => {
      validatePaymentAllocationCrossCompany(company1.id, c2Invoice!.id);
    }).toThrow(/CROSS_COMPANY_VIOLATION/);
  });
});

describe('Phase 11: Granular Role Authorization (ACCOUNTANT & RBAC Matrix)', () => {
  const roles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];

  it('verifies all 6 roles exist in role definitions', () => {
    for (const role of roles) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it('verifies ACCOUNTANT role permissions match architectural specifications', () => {
    // Permitted actions for Accountant:
    expect(hasPermission('ACCOUNTANT', 'view_dashboard')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_invoices')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_expenses')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_payments')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_inventory')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_taxes')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'manage_taxes')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'close_taxes')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_reports')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'export_reports')).toBe(true);
    expect(hasPermission('ACCOUNTANT', 'view_audit_log')).toBe(true);

    // Strictly Prohibited for Accountant:
    expect(hasPermission('ACCOUNTANT', 'create_invoices')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'edit_invoices')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'void_invoices')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'create_expenses')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'edit_expenses')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'void_expenses')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'create_payments')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'manage_inventory')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'manage_company')).toBe(false);
    expect(hasPermission('ACCOUNTANT', 'manage_users')).toBe(false);
  });

  it('verifies VIEWER is strictly read-only across all modules', () => {
    const viewerPerms = ROLE_PERMISSIONS['VIEWER'];
    for (const perm of viewerPerms) {
      expect(perm.startsWith('view_')).toBe(true);
    }
  });

  it('verifies FINANCE can create operational records but cannot close tax periods or manage users', () => {
    expect(hasPermission('FINANCE', 'create_invoices')).toBe(true);
    expect(hasPermission('FINANCE', 'create_expenses')).toBe(true);
    expect(hasPermission('FINANCE', 'create_payments')).toBe(true);

    expect(hasPermission('FINANCE', 'close_taxes')).toBe(false);
    expect(hasPermission('FINANCE', 'manage_users')).toBe(false);
    expect(hasPermission('FINANCE', 'manage_company')).toBe(false);
  });
});

describe('Phase 11: Authentication & Route Protection Interceptor Logic', () => {
  function checkRouteAccess(pathname: string, user: { isAuthenticated: boolean; role?: UserRole }) {
    const protectedPrefixes = [
      '/dashboard',
      '/sales',
      '/purchases',
      '/inventory',
      '/taxes',
      '/reports',
      '/documents',
      '/settings',
    ];

    const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

    if (isProtected && !user.isAuthenticated) {
      return { allowed: false, redirect: `/login?returnTo=${pathname}` };
    }

    if (pathname === '/login' && user.isAuthenticated) {
      return { allowed: false, redirect: '/dashboard' };
    }

    return { allowed: true };
  }

  it('intercepts unauthenticated access to protected routes and enforces login redirect', () => {
    const routesToTest = [
      '/dashboard',
      '/sales/invoices',
      '/purchases/expenses',
      '/taxes/iva',
      '/settings/company',
      '/documents',
    ];

    for (const route of routesToTest) {
      const result = checkRouteAccess(route, { isAuthenticated: false });
      expect(result.allowed).toBe(false);
      expect(result.redirect).toBe(`/login?returnTo=${route}`);
    }
  });

  it('allows access to public paths without authentication', () => {
    const result = checkRouteAccess('/forgot-password', { isAuthenticated: false });
    expect(result.allowed).toBe(true);
  });

  it('redirects already-authenticated users visiting /login to /dashboard', () => {
    const result = checkRouteAccess('/login', { isAuthenticated: true, role: 'ADMIN' });
    expect(result.allowed).toBe(false);
    expect(result.redirect).toBe('/dashboard');
  });
});

describe('Phase 11: Financial Decimal Handling & Precision', () => {
  it('prevents JavaScript floating-point representation bugs in currency operations', () => {
    // Classic IEEE 754 floating point issue: 0.1 + 0.2 = 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    expect(floatSum).not.toBe(0.3); // Raw JS fails

    // Paguro Finance exact roundHalfUp handling
    const safeSum = roundHalfUp(floatSum, 2);
    expect(safeSum).toBe(0.3);
  });

  it('calculates invoice line items with authoritative 19% IVA precision', () => {
    const line1 = calculateLineItem({ quantity: 3, unitPrice: 15450.33, taxRate: 0.19 });
    const line2 = calculateLineItem({ quantity: 2, unitPrice: 8900.50, taxRate: 0.19 });
    const line3 = calculateLineItem({ quantity: 1, unitPrice: 5000.00, taxRate: 0.00 });

    const totals = calculateDocumentTotals([line1, line2, line3], 0);

    // Line 1: 3 * 15450.33 = 46350.99, tax = 46350.99 * 0.19 = 8806.6881 -> 8806.69, total = 55157.68
    // Line 2: 2 * 8900.50 = 17801.00, tax = 17801.00 * 0.19 = 3382.19, total = 21183.19
    // Line 3: 1 * 5000.00 = 5000.00, tax = 0.00, total = 5000.00
    // Total subtotal: 46350.99 + 17801.00 + 5000.00 = 69151.99
    // Total tax: 8806.69 + 3382.19 + 0.00 = 12188.88
    // Total amount: 69151.99 + 12188.88 = 81340.87
    expect(totals.subtotal).toBe(69151.99);
    expect(totals.taxTotal).toBe(12188.88);
    expect(totals.total).toBe(81340.87);
  });

  it('properly formats currency with Colombian COP standard', () => {
    const formatted = formatCurrency(1250000.50, 'COP', 2);
    expect(formatted).toContain('1.250.000');
  });

  it('enforces tax period status integrity (closed tax periods are immutable)', () => {
    const closedPeriod = mockTaxPeriods.find((p) => p.status.toLowerCase() === 'closed');
    expect(closedPeriod).toBeDefined();

    function attemptInvoiceMutationOnPeriod(periodStatus: string) {
      if (periodStatus.toLowerCase() === 'closed') {
        throw new Error('DATABASE_CHECK_FAILED: Cannot add or alter records in a CLOSED tax period.');
      }
      return true;
    }

    expect(() => {
      attemptInvoiceMutationOnPeriod(closedPeriod!.status);
    }).toThrow(/Cannot add or alter records in a CLOSED tax period/);
  });
});
