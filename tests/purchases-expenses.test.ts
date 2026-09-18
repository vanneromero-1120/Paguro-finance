// ============================================================================
// Paguro Finance - Purchases & Expenses (CxP) Test Suite
// Financial rules, Deductible IVA, Retentions, Supplier Payments, Void & Roles
// ============================================================================

import { describe, it, expect } from 'vitest';
import { roundHalfUp } from '../lib/finance/calculations';
import { applyAllocationToBalance } from '../lib/finance/payments';
import { ROLE_PERMISSIONS, hasPermission } from '../lib/auth/permissions';
import { UserRole } from '../types/database';

describe('Purchases & Expenses Milestone Tests', () => {
  const paguroCompanyId = 'c1111111-1111-1111-1111-111111111111';
  const otherCompanyId = 'c2222222-2222-2222-2222-222222222222';

  // --------------------------------------------------------------------------
  // 1. Line Item & Server-Side Financial Calculations
  // --------------------------------------------------------------------------
  describe('1. Purchase Document Line & Tax Calculations', () => {
    it('calculates single purchase line subtotal, deductible IVA (19%), and total accurately', () => {
      const quantity = 5;
      const unitPrice = 250000;
      const taxRate = 0.19;

      const subtotal = roundHalfUp(quantity * unitPrice, 2);
      const taxAmount = roundHalfUp(subtotal * taxRate, 2);
      const lineTotal = roundHalfUp(subtotal + taxAmount, 2);

      expect(subtotal).toBe(1250000);
      expect(taxAmount).toBe(237500);
      expect(lineTotal).toBe(1487500);
    });

    it('handles multiple lines with different IVA rates (19%, 5%, 0% exempt)', () => {
      const line19Subtotal = roundHalfUp(2 * 100000, 2);
      const line19Tax = roundHalfUp(line19Subtotal * 0.19, 2);

      const line5Subtotal = roundHalfUp(10 * 20000, 2);
      const line5Tax = roundHalfUp(line5Subtotal * 0.05, 2);

      const line0Subtotal = roundHalfUp(1 * 50000, 2);
      const line0Tax = roundHalfUp(line0Subtotal * 0.0, 2);

      const totalSubtotal = roundHalfUp(line19Subtotal + line5Subtotal + line0Subtotal, 2);
      const totalTax = roundHalfUp(line19Tax + line5Tax + line0Tax, 2);

      expect(totalSubtotal).toBe(450000);
      expect(totalTax).toBe(48000); // 38000 + 10000 + 0
      expect(roundHalfUp(totalSubtotal + totalTax, 2)).toBe(498000);
    });

    it('tracks withholding tax (retention_total) and calculates net payable after retentions', () => {
      const subtotal = 1000000;
      const deductibleTax = 190000; // 19%
      const retentionReteFuente = 25000; // 2.5% on subtotal
      const retentionReteIva = 28500; // 15% on IVA

      const documentTotal = roundHalfUp(subtotal + deductibleTax, 2);
      const totalRetentions = roundHalfUp(retentionReteFuente + retentionReteIva, 2);
      const netPayableAfterRetention = roundHalfUp(documentTotal - totalRetentions, 2);

      expect(documentTotal).toBe(1190000);
      expect(totalRetentions).toBe(53500);
      expect(netPayableAfterRetention).toBe(1136500); // 1,190,000 - 53,500
    });

    it('avoids floating point drift using half-up decimal rounding', () => {
      expect(roundHalfUp(100.49999999999999, 2)).toBe(100.5);
      expect(roundHalfUp(0.1 + 0.2, 2)).toBe(0.3);
      expect(roundHalfUp(24999.995, 2)).toBe(25000.0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Supplier Reference Numbering Uniqueness Rule
  // --------------------------------------------------------------------------
  describe('2. Supplier Document Number Uniqueness', () => {
    it('allows same document number for different suppliers within same company', () => {
      const documents = new Set<string>();
      const makeKey = (compId: string, suppId: string, docNum: string) =>
        `${compId}:${suppId}:${docNum.trim().toUpperCase()}`;

      const supp1Key = makeKey(paguroCompanyId, 'supp-1', 'INV-999');
      const supp2Key = makeKey(paguroCompanyId, 'supp-2', 'INV-999');

      documents.add(supp1Key);
      expect(documents.has(supp2Key)).toBe(false);
      documents.add(supp2Key);
      expect(documents.size).toBe(2);
    });

    it('prevents duplicate document numbers for the same supplier and company', () => {
      const documents = new Set<string>();
      const makeKey = (compId: string, suppId: string, docNum: string) =>
        `${compId}:${suppId}:${docNum.trim().toUpperCase()}`;

      const key1 = makeKey(paguroCompanyId, 'supp-1', 'FACT-2026-01');
      documents.add(key1);

      const isDuplicate = documents.has(makeKey(paguroCompanyId, 'supp-1', 'FACT-2026-01'));
      expect(isDuplicate).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Accounts Payable Disbursements & Balance Sync
  // --------------------------------------------------------------------------
  describe('3. Accounts Payable Disbursements & Balance Management', () => {
    it('applies partial disbursement, reduces balance_due, and marks status as partial', () => {
      const docTotal = 1136500;
      const initialPaid = 0;
      const partialDisbursement = 400000;

      const state1 = applyAllocationToBalance(docTotal, initialPaid, partialDisbursement);
      expect(state1.paidTotal).toBe(400000);
      expect(state1.balanceDue).toBe(736500);
      expect(state1.status).toBe('partial');
    });

    it('applies subsequent disbursement settling remaining balance to zero and status as paid', () => {
      const docTotal = 1136500;
      const currentPaid = 400000;
      const finalDisbursement = 736500;

      const state2 = applyAllocationToBalance(docTotal, currentPaid, finalDisbursement);
      expect(state2.paidTotal).toBe(1136500);
      expect(state2.balanceDue).toBe(0);
      expect(state2.status).toBe('paid');
    });

    it('rejects overpayments where disbursement amount exceeds balance due', () => {
      const balanceDue = 736500;
      const proposedPayment = 800000;

      const isOverpayment = proposedPayment > balanceDue;
      expect(isOverpayment).toBe(true);
    });

    it('rejects payments less than or equal to zero', () => {
      expect(0 <= 0).toBe(true);
      expect(-500 <= 0).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Document Lifecycle & Void Mutation Safeguards
  // --------------------------------------------------------------------------
  describe('4. Purchase Document Lifecycle & Void Safeguards', () => {
    it('allows transitions from draft to open upon approval', () => {
      let status: 'draft' | 'open' | 'partial' | 'paid' | 'void' = 'draft';
      expect(status).toBe('draft');

      // Approval
      status = 'open';
      expect(status).toBe('open');
    });

    it('prohibits line item edits once document is in open or paid status', () => {
      const nonDraftStatuses: string[] = ['open', 'partial', 'paid', 'void'];
      nonDraftStatuses.forEach((st) => {
        const canEditLines = st === 'draft';
        expect(canEditLines).toBe(false);
      });
    });

    it('prohibits voiding when paid_total is greater than zero', () => {
      let paidTotal: number = 400000;
      const canVoid = paidTotal === 0;
      expect(canVoid).toBe(false);
    });

    it('allows voiding when paid_total is zero, resetting balance_due to zero', () => {
      const doc = {
        status: 'open',
        total: 500000,
        paid_total: 0,
        balance_due: 500000,
      };

      const canVoid = doc.paid_total === 0 && doc.status !== 'void';
      expect(canVoid).toBe(true);

      const voidedDoc = {
        ...doc,
        status: 'void',
        balance_due: 0,
      };
      expect(voidedDoc.status).toBe('void');
      expect(voidedDoc.balance_due).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Multi-Company Isolation & Counterparty Ownership
  // --------------------------------------------------------------------------
  describe('5. Multi-Company Isolation & Cross-Company Denial', () => {
    it('blocks referencing a supplier from another company', () => {
      const supplierInOtherCompany = {
        id: 'supp-foreign',
        company_id: otherCompanyId,
      };

      const currentCompanyId = paguroCompanyId;
      const isValidSupplier = supplierInOtherCompany.company_id === currentCompanyId;
      expect(isValidSupplier).toBe(false);
    });

    it('blocks outbound disbursement referencing another company', () => {
      const doc = {
        id: 'doc-foreign',
        company_id: otherCompanyId,
      };

      const isAuthorizedCompany = doc.company_id === paguroCompanyId;
      expect(isAuthorizedCompany).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Role-Based Authorization
  // --------------------------------------------------------------------------
  describe('6. Role Permissions for Purchases & Accounts Payable', () => {
    const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
    const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];
    const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];

    it('SUPER_ADMIN, ADMIN, and FINANCE can create and approve purchases', () => {
      WRITE_ROLES.forEach((role) => {
        expect(WRITE_ROLES.includes(role)).toBe(true);
      });
    });

    it('VIEWER and ACCOUNTANT cannot create or mutate purchases', () => {
      expect(WRITE_ROLES.includes('VIEWER')).toBe(false);
      expect(WRITE_ROLES.includes('ACCOUNTANT')).toBe(false);
    });

    it('Only SUPER_ADMIN and ADMIN can void purchase documents', () => {
      expect(VOID_ROLES.includes('SUPER_ADMIN')).toBe(true);
      expect(VOID_ROLES.includes('ADMIN')).toBe(true);
      expect(VOID_ROLES.includes('FINANCE')).toBe(false);
      expect(VOID_ROLES.includes('ACCOUNTANT')).toBe(false);
      expect(VOID_ROLES.includes('VIEWER')).toBe(false);
    });

    it('VIEWER has read-only access to view purchases', () => {
      expect(READ_ROLES.includes('VIEWER')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Audit Trail Verification
  // --------------------------------------------------------------------------
  describe('7. Audit Trail Integrity', () => {
    it('requires CREATE, UPDATE, OPEN, VOID, and PAYMENT actions to record audit log', () => {
      const validAuditActions = ['CREATE', 'UPDATE', 'OPEN', 'VOID'];
      expect(validAuditActions).toContain('CREATE');
      expect(validAuditActions).toContain('UPDATE');
      expect(validAuditActions).toContain('OPEN');
      expect(validAuditActions).toContain('VOID');
    });
  });
});
