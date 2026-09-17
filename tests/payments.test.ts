import { describe, it, expect } from 'vitest';
import {
  validatePaymentAllocations,
  applyAllocationToBalance,
} from '../lib/finance/payments';

describe('Payment Allocations & Balance Engine', () => {
  it('should validate that allocation does not exceed payment amount', () => {
    const result = validatePaymentAllocations(1000000, [
      { documentId: 'FAC-001', amount: 800000, balanceDue: 800000 },
      { documentId: 'FAC-002', amount: 300000, balanceDue: 500000 }, // Total = 1,100,000 > 1,000,000
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('supera el monto total del pago');
  });

  it('should validate that allocation does not exceed target document balance due', () => {
    const result = validatePaymentAllocations(1000000, [
      { documentId: 'FAC-001', amount: 600000, balanceDue: 500000 }, // 600k > 500k balance
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('excede el saldo pendiente');
  });

  it('should successfully validate exact and partial allocations', () => {
    const result = validatePaymentAllocations(1000000, [
      { documentId: 'FAC-001', amount: 500000, balanceDue: 800000 },
      { documentId: 'FAC-002', amount: 300000, balanceDue: 500000 },
    ]);

    expect(result.valid).toBe(true);
    expect(result.allocatedTotal).toBe(800000);
    expect(result.unallocatedPaymentAmount).toBe(200000);
  });

  it('should update document balance and set status to paid when balance is settled', () => {
    const result = applyAllocationToBalance(1000000, 500000, 500000);

    expect(result.paidTotal).toBe(1000000);
    expect(result.balanceDue).toBe(0);
    expect(result.status).toBe('paid');
  });

  it('should update document balance and set status to partial when remaining balance exists', () => {
    const result = applyAllocationToBalance(1000000, 0, 400000);

    expect(result.paidTotal).toBe(400000);
    expect(result.balanceDue).toBe(600000);
    expect(result.status).toBe('partial');
  });
});
