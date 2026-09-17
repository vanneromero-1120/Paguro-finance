// ============================================================================
// Paguro Finance - Financial Calculation Engine
// Authoritative decimal math with exact half-up rounding
// ============================================================================

/**
 * Rounds a number to a specified number of decimal places using financial half-up rounding.
 * Avoids IEEE-754 binary floating-point representation drift.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  // Add Number.EPSILON to handle floating point edge cases like 1.005 * 100 = 100.49999999999999
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export interface CalculateLineItemInput {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate: number; // e.g. 0.19 for 19%
}

export interface CalculatedLineItem {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

/**
 * Authoritative line item calculation.
 * Formula:
 * line_subtotal = round(quantity * unit_price - discount, 2)
 * line_tax = round(line_subtotal * tax_rate, 2)
 * line_total = line_subtotal + line_tax
 */
export function calculateLineItem(input: CalculateLineItemInput): CalculatedLineItem {
  const quantity = Math.max(0, input.quantity || 0);
  const unitPrice = Math.max(0, input.unitPrice || 0);
  const discountAmount = Math.max(0, input.discountAmount || 0);
  const taxRate = Math.max(0, input.taxRate || 0);

  const rawSubtotal = Math.max(0, quantity * unitPrice - discountAmount);
  const subtotal = roundHalfUp(rawSubtotal, 2);
  const taxAmount = roundHalfUp(subtotal * taxRate, 2);
  const lineTotal = roundHalfUp(subtotal + taxAmount, 2);

  return {
    quantity,
    unitPrice,
    discountAmount,
    subtotal,
    taxRate,
    taxAmount,
    lineTotal,
  };
}

export interface CalculatedDocumentTotals {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  balanceDue: number;
}

/**
 * Aggregates a list of calculated lines into authoritative document totals.
 */
export function calculateDocumentTotals(
  items: CalculatedLineItem[],
  paidTotal: number = 0
): CalculatedDocumentTotals {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    subtotal += item.subtotal;
    taxTotal += item.taxAmount;
    discountTotal += item.discountAmount;
  }

  subtotal = roundHalfUp(subtotal, 2);
  taxTotal = roundHalfUp(taxTotal, 2);
  discountTotal = roundHalfUp(discountTotal, 2);
  const total = roundHalfUp(subtotal + taxTotal, 2);

  const validPaid = Math.max(0, roundHalfUp(paidTotal, 2));
  const balanceDue = Math.max(0, roundHalfUp(total - validPaid, 2));

  return {
    subtotal,
    taxTotal,
    discountTotal,
    total,
    paidTotal: validPaid,
    balanceDue,
  };
}
