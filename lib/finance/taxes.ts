// ============================================================================
// Paguro Finance - Tax & VAT (IVA) Engine
// ============================================================================

import { roundHalfUp } from './calculations';

export interface TaxPeriodSummary {
  periodId?: string;
  startDate: string;
  endDate: string;
  generatedVat: number;    // From valid sales invoices
  deductibleVat: number;   // From valid purchases/expenses
  adjustments: number;     // Manual authorized adjustments
  netTaxPayable: number;   // generatedVat - deductibleVat + adjustments
}

export function calculateNetVat(
  generatedVat: number,
  deductibleVat: number,
  adjustments: number = 0
): number {
  const gen = roundHalfUp(Math.max(0, generatedVat), 2);
  const ded = roundHalfUp(Math.max(0, deductibleVat), 2);
  const adj = roundHalfUp(adjustments, 2);

  // If positive -> Tax payable to tax authority.
  // If negative -> Tax credit / saldo a favor.
  return roundHalfUp(gen - ded + adj, 2);
}

/**
 * Validates if a document date falls within a closed tax period.
 */
export function isDateInClosedPeriod(
  documentDate: string,
  closedPeriods: { startDate: string; endDate: string }[]
): boolean {
  const target = new Date(documentDate).getTime();
  return closedPeriods.some(p => {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    return target >= start && target <= end;
  });
}
