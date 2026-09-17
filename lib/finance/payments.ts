// ============================================================================
// Paguro Finance - Payments & Allocation Engine
// ============================================================================

import { roundHalfUp } from './calculations';

export interface AllocationValidationResult {
  valid: boolean;
  error?: string;
  allocatedTotal: number;
  unallocatedPaymentAmount: number;
}

/**
 * Validates that the sum of payment allocations does not exceed the payment total.
 */
export function validatePaymentAllocations(
  paymentAmount: number,
  allocations: { documentId: string; amount: number; balanceDue: number }[]
): AllocationValidationResult {
  let allocatedTotal = 0;

  for (const alloc of allocations) {
    if (alloc.amount <= 0) {
      return {
        valid: false,
        error: `El monto asignado debe ser mayor a 0 para el documento ${alloc.documentId}.`,
        allocatedTotal,
        unallocatedPaymentAmount: paymentAmount - allocatedTotal,
      };
    }
    if (alloc.amount > alloc.balanceDue) {
      return {
        valid: false,
        error: `El monto asignado ($${alloc.amount}) excede el saldo pendiente ($${alloc.balanceDue}) del documento ${alloc.documentId}.`,
        allocatedTotal,
        unallocatedPaymentAmount: paymentAmount - allocatedTotal,
      };
    }
    allocatedTotal += alloc.amount;
  }

  allocatedTotal = roundHalfUp(allocatedTotal, 2);
  const unallocatedPaymentAmount = roundHalfUp(paymentAmount - allocatedTotal, 2);

  if (allocatedTotal > paymentAmount) {
    return {
      valid: false,
      error: `La suma de asignaciones ($${allocatedTotal}) supera el monto total del pago ($${paymentAmount}).`,
      allocatedTotal,
      unallocatedPaymentAmount,
    };
  }

  return {
    valid: true,
    allocatedTotal,
    unallocatedPaymentAmount,
  };
}

/**
 * Computes updated balance and status after a payment allocation.
 */
export function applyAllocationToBalance(
  total: number,
  currentPaid: number,
  allocationAmount: number
): { paidTotal: number; balanceDue: number; status: 'partial' | 'paid' } {
  const newPaid = roundHalfUp(currentPaid + allocationAmount, 2);
  const newBalance = Math.max(0, roundHalfUp(total - newPaid, 2));
  const status = newBalance === 0 ? 'paid' : 'partial';

  return {
    paidTotal: newPaid,
    balanceDue: newBalance,
    status,
  };
}
