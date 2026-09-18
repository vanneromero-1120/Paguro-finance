// ============================================================================
// Paguro Finance - Financial Reporting Engine
// Authoritative calculation of aging, balances, profitability, and CSV generation
// ============================================================================

import { roundHalfUp } from './calculations';

export type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus';

/**
 * Calculates days overdue and the appropriate aging bucket based on due date.
 * If due date is in the future or today, days overdue is <= 0 and bucket is 'current'.
 */
export function calculateAgingBucket(
  dueDateStr: string,
  asOfDateStr?: string
): { daysOverdue: number; bucket: AgingBucket } {
  if (!dueDateStr) {
    return { daysOverdue: 0, bucket: 'current' };
  }

  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const due = new Date(dueDateStr);

  // Normalize to UTC midnight to avoid local DST daylight shifts
  const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());

  const diffMs = asOfUtc - dueUtc;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { daysOverdue: 0, bucket: 'current' };
  } else if (diffDays <= 30) {
    return { daysOverdue: diffDays, bucket: '1_30' };
  } else if (diffDays <= 60) {
    return { daysOverdue: diffDays, bucket: '31_60' };
  } else if (diffDays <= 90) {
    return { daysOverdue: diffDays, bucket: '61_90' };
  } else {
    return { daysOverdue: diffDays, bucket: '90_plus' };
  }
}

/**
 * Aggregates Accounts Receivable aging totals from an array of receivable items.
 */
export function aggregateReceivableAging(
  items: { balance_due: number; aging_bucket: AgingBucket }[]
): {
  total_receivable: number;
  current_amount: number;
  overdue_1_30: number;
  overdue_31_60: number;
  overdue_61_90: number;
  overdue_90_plus: number;
  invoice_count: number;
} {
  let total = 0;
  let current = 0;
  let b1_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b90_plus = 0;

  for (const item of items) {
    const bal = roundHalfUp(Math.max(0, Number(item.balance_due) || 0), 2);
    total += bal;
    switch (item.aging_bucket) {
      case 'current':
        current += bal;
        break;
      case '1_30':
        b1_30 += bal;
        break;
      case '31_60':
        b31_60 += bal;
        break;
      case '61_90':
        b61_90 += bal;
        break;
      case '90_plus':
        b90_plus += bal;
        break;
    }
  }

  return {
    total_receivable: roundHalfUp(total, 2),
    current_amount: roundHalfUp(current, 2),
    overdue_1_30: roundHalfUp(b1_30, 2),
    overdue_31_60: roundHalfUp(b31_60, 2),
    overdue_61_90: roundHalfUp(b61_90, 2),
    overdue_90_plus: roundHalfUp(b90_plus, 2),
    invoice_count: items.length,
  };
}

/**
 * Aggregates Accounts Payable aging totals from an array of payable items.
 */
export function aggregatePayableAging(
  items: { balance_due: number; aging_bucket: AgingBucket }[]
): {
  total_payable: number;
  current_amount: number;
  overdue_1_30: number;
  overdue_31_60: number;
  overdue_61_90: number;
  overdue_90_plus: number;
  document_count: number;
} {
  let total = 0;
  let current = 0;
  let b1_30 = 0;
  let b31_60 = 0;
  let b61_90 = 0;
  let b90_plus = 0;

  for (const item of items) {
    const bal = roundHalfUp(Math.max(0, Number(item.balance_due) || 0), 2);
    total += bal;
    switch (item.aging_bucket) {
      case 'current':
        current += bal;
        break;
      case '1_30':
        b1_30 += bal;
        break;
      case '31_60':
        b31_60 += bal;
        break;
      case '61_90':
        b61_90 += bal;
        break;
      case '90_plus':
        b90_plus += bal;
        break;
    }
  }

  return {
    total_payable: roundHalfUp(total, 2),
    current_amount: roundHalfUp(current, 2),
    overdue_1_30: roundHalfUp(b1_30, 2),
    overdue_31_60: roundHalfUp(b31_60, 2),
    overdue_61_90: roundHalfUp(b61_90, 2),
    overdue_90_plus: roundHalfUp(b90_plus, 2),
    document_count: items.length,
  };
}

/**
 * Calculates financial product profitability and gross margin.
 */
export function calculateProfitability(
  revenue: number,
  cogs: number
): { grossProfit: number; grossMarginPct: number } {
  const cleanRev = Math.max(0, roundHalfUp(revenue, 2));
  const cleanCogs = Math.max(0, roundHalfUp(cogs, 2));
  const grossProfit = roundHalfUp(cleanRev - cleanCogs, 2);
  const grossMarginPct = cleanRev > 0 ? roundHalfUp((grossProfit / cleanRev) * 100, 2) : 0;

  return {
    grossProfit,
    grossMarginPct,
  };
}

/**
 * Escapes a value for inclusion in a standard CSV document.
 */
export function escapeCsvValue(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  // If string contains comma, quote, or newline, escape double quotes and wrap in quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates an authoritative UTF-8 encoded CSV string with BOM for Excel compatibility.
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const BOM = '\uFEFF';
  const headerLine = headers.map(escapeCsvValue).join(',');
  const rowLines = rows.map((row) => row.map(escapeCsvValue).join(','));
  return BOM + [headerLine, ...rowLines].join('\r\n');
}
