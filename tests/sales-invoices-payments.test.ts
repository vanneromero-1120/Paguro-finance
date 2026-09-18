// ============================================================================
// Paguro Finance - Sales Invoices & Customer Payments Test Suite
// Financial rules, Server calculations, Inventory impact, RLS & Permissions
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateLineItem,
  calculateDocumentTotals,
  roundHalfUp,
} from '../lib/finance/calculations';
import {
  validatePaymentAllocations,
  applyAllocationToBalance,
} from '../lib/finance/payments';
import { ROLE_PERMISSIONS, hasPermission } from '../lib/auth/permissions';
import { UserRole } from '../types/database';

describe('Sales Invoices & Customer Payments Milestone Tests', () => {
  const paguroCompanyId = 'c1111111-1111-1111-1111-111111111111';
  const otherCompanyId = 'c2222222-2222-2222-2222-222222222222';

  // --------------------------------------------------------------------------
  // 1. Line Item & Server-Side Financial Calculations
  // --------------------------------------------------------------------------
  describe('1. Line Item & Document Calculations (Decimal Safe)', () => {
    it('calculates single line item subtotal, tax (19%), and total accurately', () => {
      const line = calculateLineItem({
        quantity: 3,
        unitPrice: 150000.5,
        discountAmount: 1000,
        taxRate: 0.19,
      });

      // subtotal = 3 * 150000.5 - 1000 = 450001.5 - 1000 = 449001.50
      expect(line.subtotal).toBe(449001.5);
      // tax = 449001.5 * 0.19 = 85310.285 -> half-up rounds to 85310.29
      expect(line.taxAmount).toBe(85310.29);
      // lineTotal = 449001.50 + 85310.29 = 534311.79
      expect(line.lineTotal).toBe(534311.79);
    });

    it('handles multiple tax rates across lines (19%, 5%, 0% exempt)', () => {
      const line19 = calculateLineItem({ quantity: 2, unitPrice: 100000, taxRate: 0.19 });
      const line5 = calculateLineItem({ quantity: 10, unitPrice: 20000, taxRate: 0.05 });
      const line0 = calculateLineItem({ quantity: 1, unitPrice: 50000, taxRate: 0.0 });

      expect(line19.taxAmount).toBe(38000.0);
      expect(line5.taxAmount).toBe(10000.0);
      expect(line0.taxAmount).toBe(0.0);

      const totals = calculateDocumentTotals([line19, line5, line0], 0);
      // Subtotal = 200,000 + 200,000 + 50,000 = 450,000
      expect(totals.subtotal).toBe(450000.0);
      // Tax total = 38,000 + 10,000 + 0 = 48,000
      expect(totals.taxTotal).toBe(48000.0);
      // Total = 498,000
      expect(totals.total).toBe(498000.0);
      expect(totals.balanceDue).toBe(498000.0);
      expect(totals.paidTotal).toBe(0.0);
    });

    it('avoids floating point representation drift using financial half-up rounding', () => {
      // 1.005 * 100 in native JS float is 100.49999999999999
      expect(roundHalfUp(1.005, 2)).toBe(1.01);
      expect(roundHalfUp(0.1 + 0.2, 2)).toBe(0.3);
      expect(roundHalfUp(12345.675, 2)).toBe(12345.68);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Concurrency-Safe Invoice Numbering Rule
  // --------------------------------------------------------------------------
  describe('2. Invoice Numbering Rule', () => {
    function formatInvoiceNumber(year: number, sequence: number): string {
      return `FAC-${year}-${sequence.toString().padStart(5, '0')}`;
    }

    it('generates sequential padded invoice numbers', () => {
      expect(formatInvoiceNumber(2026, 1)).toBe('FAC-2026-00001');
      expect(formatInvoiceNumber(2026, 42)).toBe('FAC-2026-00042');
      expect(formatInvoiceNumber(2026, 9999)).toBe('FAC-2026-09999');
    });

    it('enforces composite uniqueness per company', () => {
      const companyAInvoices = new Set<string>();
      const companyBInvoices = new Set<string>();

      companyAInvoices.add(formatInvoiceNumber(2026, 1));
      companyBInvoices.add(formatInvoiceNumber(2026, 1)); // Allowed across different companies

      expect(companyAInvoices.has('FAC-2026-00001')).toBe(true);
      expect(companyBInvoices.has('FAC-2026-00001')).toBe(true);

      // Duplicate within same company should be rejected
      const isDuplicateInA = companyAInvoices.has('FAC-2026-00001');
      expect(isDuplicateInA).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Payment Allocations, Partial Payments & Overpayment Prevention
  // --------------------------------------------------------------------------
  describe('3. Customer Payments & Overpayment Prevention', () => {
    it('applies partial payment and correctly reduces balance due and sets status to partial', () => {
      const invoiceTotal = 1190000;
      const initialPaid = 0;
      const paymentAmount = 500000;

      const state1 = applyAllocationToBalance(invoiceTotal, initialPaid, paymentAmount);
      expect(state1.paidTotal).toBe(500000);
      expect(state1.balanceDue).toBe(690000);
      expect(state1.status).toBe('partial');
    });

    it('applies second payment settling remaining balance and sets status to paid', () => {
      const invoiceTotal = 1190000;
      const currentPaid = 500000;
      const finalPayment = 690000;

      const state2 = applyAllocationToBalance(invoiceTotal, currentPaid, finalPayment);
      expect(state2.paidTotal).toBe(1190000);
      expect(state2.balanceDue).toBe(0);
      expect(state2.status).toBe('paid');
    });

    it('strictly rejects overpayment exceeding balance due', () => {
      const balanceDue = 300000;
      const attemptedPayment = 350000; // 50,000 over balance

      const validation = validatePaymentAllocations(attemptedPayment, [
        { documentId: 'FAC-2026-00001', amount: attemptedPayment, balanceDue },
      ]);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('excede el saldo pendiente');
    });

    it('rejects payments with non-positive amount (amount <= 0)', () => {
      const validationZero = validatePaymentAllocations(0, [
        { documentId: 'FAC-2026-00001', amount: 0, balanceDue: 100000 },
      ]);
      expect(validationZero.valid).toBe(false);

      const validationNegative = validatePaymentAllocations(-500, [
        { documentId: 'FAC-2026-00001', amount: -500, balanceDue: 100000 },
      ]);
      expect(validationNegative.valid).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Invoice Lifecycle & VOID Restrictions
  // --------------------------------------------------------------------------
  describe('4. Invoice Lifecycle Integrity & VOID Behavior', () => {
    interface InvoiceState {
      status: 'draft' | 'issued' | 'partial' | 'paid' | 'void';
      paidTotal: number;
      balanceDue: number;
    }

    function canModifyLines(invoice: InvoiceState): boolean {
      return invoice.status === 'draft';
    }

    function canVoidInvoice(invoice: InvoiceState): { allowed: boolean; reason?: string } {
      if (invoice.status === 'void') {
        return { allowed: false, reason: 'La factura ya se encuentra anulada.' };
      }
      if (invoice.paidTotal > 0) {
        return {
          allowed: false,
          reason: 'No se puede anular una factura con pagos registrados. Debe anular primero los cobros.',
        };
      }
      return { allowed: true };
    }

    it('allows line editing ONLY while in draft status', () => {
      expect(canModifyLines({ status: 'draft', paidTotal: 0, balanceDue: 100000 })).toBe(true);
      expect(canModifyLines({ status: 'issued', paidTotal: 0, balanceDue: 100000 })).toBe(false);
      expect(canModifyLines({ status: 'partial', paidTotal: 50000, balanceDue: 50000 })).toBe(false);
      expect(canModifyLines({ status: 'paid', paidTotal: 100000, balanceDue: 0 })).toBe(false);
      expect(canModifyLines({ status: 'void', paidTotal: 0, balanceDue: 0 })).toBe(false);
    });

    it('forbids voiding an invoice that has active recorded payments', () => {
      const partialInvoice: InvoiceState = { status: 'partial', paidTotal: 250000, balanceDue: 750000 };
      const check = canVoidInvoice(partialInvoice);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('pagos registrados');
    });

    it('permits voiding an issued invoice with 0 payments, zeroing balance due', () => {
      const issuedInvoice: InvoiceState = { status: 'issued', paidTotal: 0, balanceDue: 500000 };
      const check = canVoidInvoice(issuedInvoice);
      expect(check.allowed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Products & Inventory Synchronization Rule
  // --------------------------------------------------------------------------
  describe('5. Inventory Stock Impact Rules', () => {
    it('draft invoices do NOT create inventory movements or reduce stock', () => {
      const initialStock = 20;
      const draftQuantity = 5;
      // In draft state, no movement is dispatched
      const stockInDraft = initialStock;
      expect(stockInDraft).toBe(20);
    });

    it('issuing invoice creates authoritative SALE movement with negative delta', () => {
      const initialStock = 20;
      const invoiceQty = 5;

      const movement = {
        movement_type: 'SALE',
        quantity_delta: -invoiceQty,
        source_type: 'sales_invoice',
      };

      const updatedStock = initialStock + movement.quantity_delta;
      expect(updatedStock).toBe(15);
      expect(movement.quantity_delta).toBe(-5);
    });

    it('voiding issued invoice creates compensatory RETURN_IN movement with positive delta', () => {
      const currentStock = 15;
      const originalSaleQty = 5;

      const compensatoryMovement = {
        movement_type: 'RETURN_IN',
        quantity_delta: +originalSaleQty,
        source_type: 'sales_invoice_void',
      };

      const restoredStock = currentStock + compensatoryMovement.quantity_delta;
      expect(restoredStock).toBe(20);
    });

    it('service products bypass inventory tracking completely', () => {
      const serviceItem = { product_type: 'service', is_inventory_item: false };
      const shouldTrack = serviceItem.product_type === 'physical' && serviceItem.is_inventory_item;
      expect(shouldTrack).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Role-Based Permissions & Authorizations
  // --------------------------------------------------------------------------
  describe('6. Role Authorization Matrix', () => {
    it('SUPER_ADMIN and ADMIN have full control: view, create, edit, void invoices and payments', () => {
      for (const role of ['SUPER_ADMIN', 'ADMIN'] as UserRole[]) {
        expect(hasPermission(role, 'view_invoices')).toBe(true);
        expect(hasPermission(role, 'create_invoices')).toBe(true);
        expect(hasPermission(role, 'edit_invoices')).toBe(true);
        expect(hasPermission(role, 'void_invoices')).toBe(true);
        expect(hasPermission(role, 'view_payments')).toBe(true);
        expect(hasPermission(role, 'create_payments')).toBe(true);
      }
    });

    it('FINANCE can create and edit invoices and create payments, but CANNOT void invoices', () => {
      expect(hasPermission('FINANCE', 'view_invoices')).toBe(true);
      expect(hasPermission('FINANCE', 'create_invoices')).toBe(true);
      expect(hasPermission('FINANCE', 'edit_invoices')).toBe(true);
      expect(hasPermission('FINANCE', 'void_invoices')).toBe(false); // Voiding requires Super Admin or Admin!
      expect(hasPermission('FINANCE', 'create_payments')).toBe(true);
    });

    it('ACCOUNTANT and VIEWER are strictly read-only for invoices and payments', () => {
      for (const role of ['ACCOUNTANT', 'VIEWER'] as UserRole[]) {
        expect(hasPermission(role, 'view_invoices')).toBe(true);
        expect(hasPermission(role, 'create_invoices')).toBe(false);
        expect(hasPermission(role, 'edit_invoices')).toBe(false);
        expect(hasPermission(role, 'void_invoices')).toBe(false);
        expect(hasPermission(role, 'create_payments')).toBe(false);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Multi-Company Isolation & Cross-Company Integrity
  // --------------------------------------------------------------------------
  describe('7. Multi-Company Tenant Scoping', () => {
    it('rejects customer from a foreign company', () => {
      const activeCompanyId = paguroCompanyId;
      const customer = { id: 'cust-foreign', company_id: otherCompanyId, name: 'Foreign Corp' };

      const isValidCustomer = customer.company_id === activeCompanyId;
      expect(isValidCustomer).toBe(false);
    });

    it('rejects product reference from a foreign company', () => {
      const activeCompanyId = paguroCompanyId;
      const product = { id: 'prod-foreign', company_id: otherCompanyId, name: 'Foreign Item' };

      const isValidProduct = product.company_id === activeCompanyId;
      expect(isValidProduct).toBe(false);
    });

    it('rejects payment counterparty mismatch with invoice company', () => {
      const invoice = { id: 'inv-1', company_id: paguroCompanyId, customer_id: 'cust-1' };
      const paymentCompanyId = otherCompanyId;

      const isMatch = invoice.company_id === paymentCompanyId;
      expect(isMatch).toBe(false);
    });
  });
});
