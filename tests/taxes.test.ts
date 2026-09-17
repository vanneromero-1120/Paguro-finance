import { describe, it, expect } from 'vitest';
import { calculateNetVat, isDateInClosedPeriod } from '../lib/finance/taxes';

describe('Taxes and VAT Engine', () => {
  it('should calculate net VAT payable as generated - deductible + adjustments', () => {
    const generatedVat = 1900000;
    const deductibleVat = 800000;
    const adjustments = 50000;

    const netVat = calculateNetVat(generatedVat, deductibleVat, adjustments);

    // 1,900,000 - 800,000 + 50,000 = 1,150,000
    expect(netVat).toBe(1150000);
  });

  it('should calculate negative net tax as tax credit / saldo a favor', () => {
    const generatedVat = 500000;
    const deductibleVat = 1200000;
    const adjustments = 0;

    const netVat = calculateNetVat(generatedVat, deductibleVat, adjustments);

    // 500,000 - 1,200,000 = -700,000 (credit)
    expect(netVat).toBe(-700000);
  });

  it('should accurately detect whether a document date falls into a closed tax period', () => {
    const closedPeriods = [
      { startDate: '2026-07-01', endDate: '2026-08-31' },
      { startDate: '2026-05-01', endDate: '2026-06-30' },
    ];

    expect(isDateInClosedPeriod('2026-07-15', closedPeriods)).toBe(true);
    expect(isDateInClosedPeriod('2026-08-31', closedPeriods)).toBe(true);
    expect(isDateInClosedPeriod('2026-09-01', closedPeriods)).toBe(false);
    expect(isDateInClosedPeriod('2026-10-10', closedPeriods)).toBe(false);
  });
});
