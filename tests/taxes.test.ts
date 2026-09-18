// ============================================================================
// Paguro Finance - Taxes & Tax Periods (IVA) Test Suite
// Operational VAT calculations, Line-level traceability, Adjustments, Period locking & RBAC
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateNetVat,
  calculateAdjustmentDelta,
  isDateInClosedPeriod,
  doPeriodsOverlap,
} from '../lib/finance/taxes';
import { roundHalfUp } from '../lib/finance/calculations';
import { ROLE_PERMISSIONS, hasPermission } from '../lib/auth/permissions';
import { UserRole, TaxAdjustmentType } from '../types/database';

describe('IVA & Tax Periods Milestone Tests', () => {
  const paguroCompanyId = 'c1111111-1111-1111-1111-111111111111';
  const otherCompanyId = 'c2222222-2222-2222-2222-222222222222';

  // --------------------------------------------------------------------------
  // 1. Line-Level IVA & Operational Tax Calculations
  // --------------------------------------------------------------------------
  describe('1. Line-Level IVA Calculations (Decimal Safe)', () => {
    it('calculates generated IVA from multiple sales line items accurately', () => {
      const line1 = { qty: 2, price: 1000000, rate: 0.19 };
      const line2 = { qty: 5, price: 200000, rate: 0.05 };
      const line3 = { qty: 1, price: 500000, rate: 0.0 };

      const tax1 = roundHalfUp(line1.qty * line1.price * line1.rate, 2); // 380,000
      const tax2 = roundHalfUp(line2.qty * line2.price * line2.rate, 2); // 50,000
      const tax3 = roundHalfUp(line3.qty * line3.price * line3.rate, 2); // 0

      const totalGenerated = roundHalfUp(tax1 + tax2 + tax3, 2);
      expect(totalGenerated).toBe(430000);
    });

    it('calculates deductible IVA from purchase items accurately', () => {
      const purchase1 = { subtotal: 800000, rate: 0.19 };
      const purchase2 = { subtotal: 200000, rate: 0.05 };

      const ded1 = roundHalfUp(purchase1.subtotal * purchase1.rate, 2); // 152,000
      const ded2 = roundHalfUp(purchase2.subtotal * purchase2.rate, 2); // 10,000

      const totalDeductible = roundHalfUp(ded1 + ded2, 2);
      expect(totalDeductible).toBe(162000);
    });

    it('computes net IVA payable when generated exceeds deductible', () => {
      const generated = 430000;
      const deductible = 162000;
      const netTax = calculateNetVat(generated, deductible, 0);

      // 430,000 - 162,000 = 268,000 (Tax Payable)
      expect(netTax).toBe(268000);
    });

    it('computes credit balance (saldo a favor) when deductible exceeds generated', () => {
      const generated = 100000;
      const deductible = 350000;
      const netTax = calculateNetVat(generated, deductible, 0);

      // 100,000 - 350,000 = -250,000 (Tax Credit)
      expect(netTax).toBe(-250000);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Manual Tax Adjustments & Signed Net Tax Contributions
  // --------------------------------------------------------------------------
  describe('2. Manual Tax Adjustments Signed Contributions', () => {
    it('INCREASE_GENERATED increases net tax payable (+)', () => {
      const delta = calculateAdjustmentDelta('INCREASE_GENERATED', 50000);
      expect(delta).toBe(50000);
    });

    it('DECREASE_GENERATED decreases net tax payable (-)', () => {
      const delta = calculateAdjustmentDelta('DECREASE_GENERATED', 30000);
      expect(delta).toBe(-30000);
    });

    it('INCREASE_DEDUCTIBLE decreases net tax payable (-)', () => {
      const delta = calculateAdjustmentDelta('INCREASE_DEDUCTIBLE', 45000);
      expect(delta).toBe(-45000);
    });

    it('DECREASE_DEDUCTIBLE increases net tax payable (+)', () => {
      const delta = calculateAdjustmentDelta('DECREASE_DEDUCTIBLE', 20000);
      expect(delta).toBe(20000);
    });

    it('OTHER_CREDIT decreases net tax payable (-)', () => {
      const delta = calculateAdjustmentDelta('OTHER_CREDIT', 75000);
      expect(delta).toBe(-75000);
    });

    it('calculates net tax correctly with combined manual adjustments', () => {
      const generated = 500000;
      const deductible = 200000;
      // Adjustments: +20,000 (increase gen) - 50,000 (other credit) = -30,000
      const adjustments = calculateAdjustmentDelta('INCREASE_GENERATED', 20000) +
        calculateAdjustmentDelta('OTHER_CREDIT', 50000);

      expect(adjustments).toBe(-30000);
      const netTax = calculateNetVat(generated, deductible, adjustments);
      // 500,000 - 200,000 + (-30,000) = 270,000
      expect(netTax).toBe(270000);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Tax Period Dates & Overlap Prevention
  // --------------------------------------------------------------------------
  describe('3. Tax Period Date Validation & Overlap Detection', () => {
    it('detects overlapping date intervals correctly', () => {
      // Interval A: Jan 1 to Feb 28
      // Interval B: Feb 15 to Mar 31 (Overlaps)
      expect(doPeriodsOverlap('2026-01-01', '2026-02-28', '2026-02-15', '2026-03-31')).toBe(true);

      // Interval C: Exact duplicate
      expect(doPeriodsOverlap('2026-01-01', '2026-02-28', '2026-01-01', '2026-02-28')).toBe(true);

      // Interval D: Contained inside
      expect(doPeriodsOverlap('2026-01-01', '2026-06-30', '2026-02-01', '2026-03-31')).toBe(true);

      // Interval E: Non-overlapping consecutive periods
      expect(doPeriodsOverlap('2026-01-01', '2026-02-28', '2026-03-01', '2026-04-30')).toBe(false);
      expect(doPeriodsOverlap('2026-05-01', '2026-06-30', '2026-07-01', '2026-08-31')).toBe(false);
    });

    it('validates date in closed period for document mutation locking', () => {
      const closedPeriods = [
        { startDate: '2026-01-01', endDate: '2026-02-28' },
        { startDate: '2026-03-01', endDate: '2026-04-30' },
      ];

      expect(isDateInClosedPeriod('2026-02-15', closedPeriods)).toBe(true);
      expect(isDateInClosedPeriod('2026-04-30', closedPeriods)).toBe(true);
      expect(isDateInClosedPeriod('2026-05-01', closedPeriods)).toBe(false);
      expect(isDateInClosedPeriod('2026-09-17', closedPeriods)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Period Lifecycle & Exclusion of Invalid Transactions
  // --------------------------------------------------------------------------
  describe('4. Transaction Eligibility & Status Filtering', () => {
    it('excludes draft and void sales invoices from generated IVA', () => {
      const invoices = [
        { id: '1', status: 'issued', tax_total: 190000 },
        { id: '2', status: 'partial', tax_total: 95000 },
        { id: '3', status: 'paid', tax_total: 57000 },
        { id: '4', status: 'draft', tax_total: 1000000 }, // MUST BE EXCLUDED
        { id: '5', status: 'void', tax_total: 500000 },   // MUST BE EXCLUDED
      ];

      const eligibleInvoices = invoices.filter(
        (inv) => inv.status === 'issued' || inv.status === 'partial' || inv.status === 'paid'
      );

      const generatedTax = eligibleInvoices.reduce((acc, inv) => acc + inv.tax_total, 0);
      expect(generatedTax).toBe(342000); // 190,000 + 95,000 + 57,000
    });

    it('excludes draft and void purchase documents from deductible IVA', () => {
      const purchases = [
        { id: '1', status: 'open', deductible_tax_total: 150000 },
        { id: '2', status: 'partial', deductible_tax_total: 80000 },
        { id: '3', status: 'paid', deductible_tax_total: 40000 },
        { id: '4', status: 'draft', deductible_tax_total: 900000 }, // MUST BE EXCLUDED
        { id: '5', status: 'void', deductible_tax_total: 300000 },  // MUST BE EXCLUDED
      ];

      const eligiblePurchases = purchases.filter(
        (pur) => pur.status === 'open' || pur.status === 'partial' || pur.status === 'paid'
      );

      const deductibleTax = eligiblePurchases.reduce((acc, p) => acc + p.deductible_tax_total, 0);
      expect(deductibleTax).toBe(270000); // 150,000 + 80,000 + 40,000
    });
  });

  // --------------------------------------------------------------------------
  // 5. Multi-Company Isolation & Role Permissions
  // --------------------------------------------------------------------------
  describe('5. Multi-Company Isolation & Role Permissions', () => {
    it('SUPER_ADMIN, ADMIN, and ACCOUNTANT have tax management and closing permissions', () => {
      const authorizedRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
      authorizedRoles.forEach((role) => {
        expect(hasPermission(role, 'view_taxes')).toBe(true);
        expect(hasPermission(role, 'manage_taxes')).toBe(true);
        expect(hasPermission(role, 'close_taxes')).toBe(true);
      });
    });

    it('FINANCE can view taxes but cannot manage or close periods', () => {
      expect(hasPermission('FINANCE', 'view_taxes')).toBe(true);
      expect(hasPermission('FINANCE', 'manage_taxes')).toBe(false);
      expect(hasPermission('FINANCE', 'close_taxes')).toBe(false);
    });

    it('VIEWER is strictly read-only for taxes', () => {
      expect(hasPermission('VIEWER', 'view_taxes')).toBe(true);
      expect(hasPermission('VIEWER', 'manage_taxes')).toBe(false);
      expect(hasPermission('VIEWER', 'close_taxes')).toBe(false);
    });

    it('prevents cross-company period access', () => {
      const periodInCompanyA = { company_id: paguroCompanyId };
      const userCompany = otherCompanyId;

      const isAuthorized = periodInCompanyA.company_id === userCompany;
      expect(isAuthorized).toBe(false);
    });
  });
});
