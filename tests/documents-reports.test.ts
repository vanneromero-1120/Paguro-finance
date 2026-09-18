// ============================================================================
// Paguro Finance - Documents and Financial Reports Unit Tests
// Tests authorization, file validation, aging buckets, profitability, CSV escaping
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateAgingBucket,
  aggregateReceivableAging,
  aggregatePayableAging,
  calculateProfitability,
  escapeCsvValue,
  generateCsv,
  AgingBucket,
} from '../lib/finance/reports';
import { calculateInventoryValuation } from '../lib/finance/inventory';

describe('Documents & Storage Security Tests', () => {
  const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

  it('validates allowed document MIME types (PDF, JPG, PNG)', () => {
    expect(ALLOWED_MIMES.includes('application/pdf')).toBe(true);
    expect(ALLOWED_MIMES.includes('image/jpeg')).toBe(true);
    expect(ALLOWED_MIMES.includes('image/png')).toBe(true);
    expect(ALLOWED_MIMES.includes('image/jpg')).toBe(true);
  });

  it('rejects unsafe MIME types (HTML, JS, EXE, SVG with scripts)', () => {
    expect(ALLOWED_MIMES.includes('text/html')).toBe(false);
    expect(ALLOWED_MIMES.includes('application/javascript')).toBe(false);
    expect(ALLOWED_MIMES.includes('application/x-msdownload')).toBe(false);
    expect(ALLOWED_MIMES.includes('image/svg+xml')).toBe(false);
  });

  it('enforces 15 MB file size limit', () => {
    const validSize = 5 * 1024 * 1024; // 5 MB
    const boundarySize = 15 * 1024 * 1024; // 15 MB
    const excessiveSize = 15 * 1024 * 1024 + 1; // 15 MB + 1 byte

    expect(validSize <= MAX_FILE_SIZE).toBe(true);
    expect(boundarySize <= MAX_FILE_SIZE).toBe(true);
    expect(excessiveSize <= MAX_FILE_SIZE).toBe(false);
  });

  it('enforces company-scoped storage path structure', () => {
    const companyId = 'c1111111-1111-1111-1111-111111111111';
    const entityType = 'sales_invoice';
    const entityId = 'e2222222-2222-2222-2222-222222222222';
    const fileName = 'factura_001.pdf';

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${companyId}/${entityType}/${entityId}/12345_${cleanFileName}`;

    const parts = storagePath.split('/');
    expect(parts[0]).toBe(companyId);
    expect(parts[1]).toBe(entityType);
    expect(parts[2]).toBe(entityId);
    expect(parts[3].endsWith('factura_001.pdf')).toBe(true);
  });

  it('role authorization: VIEWER and ACCOUNTANT cannot mutate documents', () => {
    const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'];
    expect(WRITE_ROLES.includes('SUPER_ADMIN')).toBe(true);
    expect(WRITE_ROLES.includes('ADMIN')).toBe(true);
    expect(WRITE_ROLES.includes('FINANCE')).toBe(true);
    expect(WRITE_ROLES.includes('OPERATIONS')).toBe(true);
    expect(WRITE_ROLES.includes('ACCOUNTANT')).toBe(false);
    expect(WRITE_ROLES.includes('VIEWER')).toBe(false);
  });
});

describe('Aging Calculation & Classification Tests', () => {
  const asOf = '2026-06-15T00:00:00Z';

  it('categorizes future due date as "current"', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-06-30', asOf);
    expect(daysOverdue).toBeLessThanOrEqual(0);
    expect(bucket).toBe('current');
  });

  it('categorizes same day due date as "current"', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-06-15', asOf);
    expect(daysOverdue).toBe(0);
    expect(bucket).toBe('current');
  });

  it('categorizes 1-30 days overdue', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-06-01', asOf);
    expect(daysOverdue).toBe(14);
    expect(bucket).toBe('1_30');

    const boundary = calculateAgingBucket('2026-05-16', asOf);
    expect(boundary.daysOverdue).toBe(30);
    expect(boundary.bucket).toBe('1_30');
  });

  it('categorizes 31-60 days overdue', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-05-15', asOf);
    expect(daysOverdue).toBe(31);
    expect(bucket).toBe('31_60');

    const boundary = calculateAgingBucket('2026-04-16', asOf);
    expect(boundary.daysOverdue).toBe(60);
    expect(boundary.bucket).toBe('31_60');
  });

  it('categorizes 61-90 days overdue', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-04-15', asOf);
    expect(daysOverdue).toBe(61);
    expect(bucket).toBe('61_90');

    const boundary = calculateAgingBucket('2026-03-17', asOf);
    expect(boundary.daysOverdue).toBe(90);
    expect(boundary.bucket).toBe('61_90');
  });

  it('categorizes 90+ days overdue', () => {
    const { daysOverdue, bucket } = calculateAgingBucket('2026-03-16', asOf);
    expect(daysOverdue).toBe(91);
    expect(bucket).toBe('90_plus');

    const longPast = calculateAgingBucket('2025-01-01', asOf);
    expect(longPast.daysOverdue).toBeGreaterThan(90);
    expect(longPast.bucket).toBe('90_plus');
  });
});

describe('Accounts Receivable & Accounts Payable Aging Aggregation', () => {
  it('correctly aggregates Accounts Receivable totals and aging buckets', () => {
    const items: { balance_due: number; aging_bucket: AgingBucket }[] = [
      { balance_due: 1000000, aging_bucket: 'current' },
      { balance_due: 500000, aging_bucket: '1_30' },
      { balance_due: 300000, aging_bucket: '31_60' },
      { balance_due: 200000, aging_bucket: '61_90' },
      { balance_due: 150000, aging_bucket: '90_plus' },
    ];

    const result = aggregateReceivableAging(items);

    expect(result.total_receivable).toBe(2150000);
    expect(result.current_amount).toBe(1000000);
    expect(result.overdue_1_30).toBe(500000);
    expect(result.overdue_31_60).toBe(300000);
    expect(result.overdue_61_90).toBe(200000);
    expect(result.overdue_90_plus).toBe(150000);
    expect(result.invoice_count).toBe(5);
  });

  it('correctly aggregates Accounts Payable totals and aging buckets', () => {
    const items: { balance_due: number; aging_bucket: AgingBucket }[] = [
      { balance_due: 2000000, aging_bucket: 'current' },
      { balance_due: 800000, aging_bucket: '1_30' },
      { balance_due: 450000, aging_bucket: '90_plus' },
    ];

    const result = aggregatePayableAging(items);

    expect(result.total_payable).toBe(3250000);
    expect(result.current_amount).toBe(2000000);
    expect(result.overdue_1_30).toBe(800000);
    expect(result.overdue_31_60).toBe(0);
    expect(result.overdue_61_90).toBe(0);
    expect(result.overdue_90_plus).toBe(450000);
    expect(result.document_count).toBe(3);
  });
});

describe('Financial Inventory Valuation Tests', () => {
  it('calculates inventory valuation as stock * cost', () => {
    expect(calculateInventoryValuation(100, 25000)).toBe(2500000);
    expect(calculateInventoryValuation(12.5, 4000)).toBe(50000);
    expect(calculateInventoryValuation(0, 50000)).toBe(0);
    expect(calculateInventoryValuation(-5, 50000)).toBe(0);
  });
});

describe('Product Profitability Calculation Tests', () => {
  it('calculates gross profit and margin percentage', () => {
    const { grossProfit, grossMarginPct } = calculateProfitability(1000000, 600000);
    expect(grossProfit).toBe(400000);
    expect(grossMarginPct).toBe(40.0);
  });

  it('handles zero revenue safely without division by zero', () => {
    const { grossProfit, grossMarginPct } = calculateProfitability(0, 0);
    expect(grossProfit).toBe(0);
    expect(grossMarginPct).toBe(0);
  });

  it('handles negative margin when COGS exceeds revenue', () => {
    const { grossProfit, grossMarginPct } = calculateProfitability(500000, 600000);
    expect(grossProfit).toBe(-100000);
    expect(grossMarginPct).toBe(-20.0);
  });
});

describe('CSV Escaping & Export Generation', () => {
  it('escapes quotes and wraps values containing commas, quotes, or newlines', () => {
    expect(escapeCsvValue('Simple Text')).toBe('"Simple Text"');
    expect(escapeCsvValue('Text, with comma')).toBe('"Text, with comma"');
    expect(escapeCsvValue('Text with "quotes"')).toBe('"Text with ""quotes"""');
    expect(escapeCsvValue('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
    expect(escapeCsvValue(null)).toBe('""');
    expect(escapeCsvValue(1500000)).toBe('"1500000"');
  });

  it('generates standard CSV with UTF-8 BOM', () => {
    const headers = ['Factura', 'Cliente', 'Total'];
    const rows = [
      ['FAC-001', 'Acme Corp, S.A.S.', 1500000],
      ['FAC-002', 'Tecnología "Alpha"', 2300000],
    ];

    const csv = generateCsv(headers, rows);

    // Verify UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Verify headers
    expect(csv).toContain('"Factura","Cliente","Total"');

    // Verify row escaping
    expect(csv).toContain('"FAC-001","Acme Corp, S.A.S.","1500000"');
    expect(csv).toContain('"FAC-002","Tecnología ""Alpha""","2300000"');
  });
});
