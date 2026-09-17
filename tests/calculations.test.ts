import { describe, it, expect } from 'vitest';
import {
  roundHalfUp,
  calculateLineItem,
  calculateDocumentTotals,
} from '../lib/finance/calculations';

describe('Financial Calculation Engine', () => {
  it('should round numbers half-up without IEEE-754 binary floating-point drift', () => {
    expect(roundHalfUp(10.005, 2)).toBe(10.01);
    expect(roundHalfUp(10.004, 2)).toBe(10.00);
    expect(roundHalfUp(0.1 + 0.2, 2)).toBe(0.30);
    expect(roundHalfUp(1234567.894, 2)).toBe(1234567.89);
    expect(roundHalfUp(1234567.895, 2)).toBe(1234567.90);
  });

  it('should accurately calculate line item subtotals and 19% IVA', () => {
    const line = calculateLineItem({
      quantity: 10,
      unitPrice: 350000,
      discountAmount: 0,
      taxRate: 0.19,
    });

    expect(line.subtotal).toBe(3500000);
    expect(line.taxAmount).toBe(665000);
    expect(line.lineTotal).toBe(4165000);
  });

  it('should handle item discounts correctly in subtotal and tax calculation', () => {
    const line = calculateLineItem({
      quantity: 2,
      unitPrice: 100000,
      discountAmount: 20000, // 200,000 - 20,000 = 180,000
      taxRate: 0.19,
    });

    expect(line.subtotal).toBe(180000);
    expect(line.taxAmount).toBe(34200); // 180,000 * 0.19
    expect(line.lineTotal).toBe(214200);
  });

  it('should aggregate document totals and compute outstanding balance', () => {
    const items = [
      calculateLineItem({ quantity: 1, unitPrice: 100000, taxRate: 0.19 }),
      calculateLineItem({ quantity: 2, unitPrice: 50000, taxRate: 0.19 }),
    ];

    const totals = calculateDocumentTotals(items, 150000);

    expect(totals.subtotal).toBe(200000);
    expect(totals.taxTotal).toBe(38000);
    expect(totals.total).toBe(238000);
    expect(totals.paidTotal).toBe(150000);
    expect(totals.balanceDue).toBe(88000); // 238,000 - 150,000
  });

  it('should never return negative balance due even if overpaid', () => {
    const items = [calculateLineItem({ quantity: 1, unitPrice: 100000, taxRate: 0 })];
    const totals = calculateDocumentTotals(items, 150000);

    expect(totals.balanceDue).toBe(0);
  });
});
