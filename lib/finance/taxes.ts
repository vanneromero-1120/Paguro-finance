import { roundHalfUp } from './calculations';
import { TaxAdjustmentType } from '@/types/database';

export interface TaxPeriodSummary {
  periodId?: string;
  startDate: string;
  endDate: string;
  generatedVat: number;    // From valid sales invoices
  deductibleVat: number;   // From valid purchases/expenses
  adjustments: number;     // Manual authorized adjustments
  netTaxPayable: number;   // generatedVat - deductibleVat + adjustments
}

/**
 * Calculates net VAT (IVA) payable or credit balance.
 * If positive -> Estimated tax payable to DIAN / Tax Authority.
 * If negative -> Tax credit / Saldo a favor.
 */
export function calculateNetVat(
  generatedVat: number,
  deductibleVat: number,
  adjustments: number = 0
): number {
  const gen = roundHalfUp(Math.max(0, generatedVat), 2);
  const ded = roundHalfUp(Math.max(0, deductibleVat), 2);
  const adj = roundHalfUp(adjustments, 2);

  return roundHalfUp(gen - ded + adj, 2);
}

/**
 * Computes the signed contribution of a tax adjustment to the `adjustments` total.
 * Since net_tax = generated_tax - deductible_tax + adjustments:
 * - Debit adjustments (increase generated or decrease deductible) add to net tax (+).
 * - Credit adjustments (decrease generated, increase deductible, or other credit) reduce net tax (-).
 */
export function calculateAdjustmentDelta(type: TaxAdjustmentType, amount: number): number {
  const absAmount = roundHalfUp(Math.abs(amount), 2);
  switch (type) {
    case 'INCREASE_GENERATED':
    case 'DECREASE_DEDUCTIBLE':
      return absAmount;
    case 'DECREASE_GENERATED':
    case 'INCREASE_DEDUCTIBLE':
    case 'OTHER_CREDIT':
      return -absAmount;
    default:
      return 0;
  }
}

/**
 * Validates if a document date falls within a closed tax period.
 */
export function isDateInClosedPeriod(
  documentDate: string,
  closedPeriods: { startDate: string; endDate: string }[]
): boolean {
  const target = new Date(documentDate).getTime();
  return closedPeriods.some((p) => {
    const start = new Date(p.startDate).getTime();
    const end = new Date(p.endDate).getTime();
    return target >= start && target <= end;
  });
}

/**
 * Checks if two date intervals overlap.
 */
export function doPeriodsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA <= eB && eA >= sB;
}
