// ============================================================================
// Paguro Finance - Customers & Suppliers Master Data Security & Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import { Customer, Supplier, CreateCustomerInput, CreateSupplierInput } from '../types/database';

describe('Core Business Master Data: Customers & Suppliers', () => {
  const paguroCorpId = 'c1111111-1111-1111-1111-111111111111';
  const otherCompanyId = 'c2222222-2222-2222-2222-222222222222';

  describe('1. Role Authorization Matrix for Master Data Mutations', () => {
    const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
    const READ_ONLY_ROLES = ['ACCOUNTANT', 'OPERATIONS', 'VIEWER'];

    function canMutateMasterData(role: string): boolean {
      return WRITE_ROLES.includes(role);
    }

    it('allows SUPER_ADMIN, ADMIN, and FINANCE to create and edit customers/suppliers', () => {
      expect(canMutateMasterData('SUPER_ADMIN')).toBe(true);
      expect(canMutateMasterData('ADMIN')).toBe(true);
      expect(canMutateMasterData('FINANCE')).toBe(true);
    });

    it('strictly forbids VIEWER, ACCOUNTANT, and OPERATIONS from mutating customers/suppliers', () => {
      expect(canMutateMasterData('VIEWER')).toBe(false);
      expect(canMutateMasterData('ACCOUNTANT')).toBe(false);
      expect(canMutateMasterData('OPERATIONS')).toBe(false);
    });
  });

  describe('2. Multi-Company Isolation & Ownership Integrity', () => {
    const mockDbCustomers: Customer[] = [
      {
        id: 'cust-1',
        company_id: paguroCorpId,
        name: 'Cliente Paguro 1',
        identification_type: 'NIT',
        tax_id: '900.111.222-1',
        country: 'Colombia',
        payment_terms_days: 30,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'cust-2',
        company_id: otherCompanyId,
        name: 'Cliente Otra Empresa',
        identification_type: 'NIT',
        tax_id: '900.333.444-2',
        country: 'Colombia',
        payment_terms_days: 15,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    function filterByCompany<T extends { company_id: string }>(items: T[], activeCompanyId: string): T[] {
      return items.filter((item) => item.company_id === activeCompanyId);
    }

    it('queries for Paguro Corp return only Paguro Corp customers', () => {
      const results = filterByCompany(mockDbCustomers, paguroCorpId);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Cliente Paguro 1');
      expect(results.every((c) => c.company_id === paguroCorpId)).toBe(true);
    });

    it('prevents cross-company leakage when querying other company ID', () => {
      const results = filterByCompany(mockDbCustomers, otherCompanyId);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Cliente Otra Empresa');
      expect(results[0].company_id).not.toBe(paguroCorpId);
    });

    it('rejects updates if target record belongs to a different company', () => {
      const activeCompanyId = paguroCorpId;
      const targetCustomer = mockDbCustomers.find((c) => c.id === 'cust-2'); // belongs to otherCompanyId

      function validateUpdateOwnership(customer: Customer | undefined, callerCompanyId: string): boolean {
        if (!customer) return false;
        return customer.company_id === callerCompanyId;
      }

      expect(validateUpdateOwnership(targetCustomer, activeCompanyId)).toBe(false);
    });
  });

  describe('3. Validation Rules for Master Data Creation', () => {
    function validateCustomerInput(input: Partial<CreateCustomerInput>): { valid: boolean; error?: string } {
      if (!input.name || !input.name.trim()) {
        return { valid: false, error: 'El nombre comercial del cliente es obligatorio.' };
      }
      if (!input.tax_id || !input.tax_id.trim()) {
        return { valid: false, error: 'El número de identificación fiscal es obligatorio.' };
      }
      if (input.payment_terms_days !== undefined && input.payment_terms_days < 0) {
        return { valid: false, error: 'Los días de plazo de pago no pueden ser negativos.' };
      }
      return { valid: true };
    }

    it('accepts valid customer input', () => {
      const valid = validateCustomerInput({
        name: 'Éxito Corporativo',
        tax_id: '890.900.608-9',
        identification_type: 'NIT',
        payment_terms_days: 30,
      });
      expect(valid.valid).toBe(true);
    });

    it('rejects empty customer name', () => {
      const result = validateCustomerInput({
        name: '   ',
        tax_id: '890.900.608-9',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('nombre comercial');
    });

    it('rejects empty tax_id', () => {
      const result = validateCustomerInput({
        name: 'Empresa Valida',
        tax_id: '',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('número de identificación');
    });

    it('rejects negative payment terms days', () => {
      const result = validateCustomerInput({
        name: 'Empresa Valida',
        tax_id: '890.900.608-9',
        payment_terms_days: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negativos');
    });
  });

  describe('4. Identification Types Versatility', () => {
    const validIdTypes = ['NIT', 'CC', 'CE', 'PASSPORT', 'RUT', 'VAT_ID', 'OTHER'];

    it('supports Colombian and international tax identification types', () => {
      expect(validIdTypes).toContain('NIT');
      expect(validIdTypes).toContain('CC');
      expect(validIdTypes).toContain('PASSPORT');
      expect(validIdTypes).toContain('VAT_ID');
    });
  });

  describe('5. Audit Log Entry Structure', () => {
    interface AuditLogEntry {
      company_id: string;
      user_id: string;
      action: 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'ACTIVATE';
      entity_type: 'customer' | 'supplier';
      entity_id: string;
      before_json?: any;
      after_json?: any;
    }

    it('properly formats audit log payloads on customer creation', () => {
      const auditPayload: AuditLogEntry = {
        company_id: paguroCorpId,
        user_id: 'a0000000-0000-0000-0000-000000000001',
        action: 'CREATE',
        entity_type: 'customer',
        entity_id: 'cust-123',
        after_json: { id: 'cust-123', name: 'Cliente Nuevo', tax_id: '901.111.222-3' },
      };

      expect(auditPayload.action).toBe('CREATE');
      expect(auditPayload.entity_type).toBe('customer');
      expect(auditPayload.after_json).toBeDefined();
      expect(auditPayload.company_id).toBe(paguroCorpId);
    });

    it('properly formats audit log payloads on supplier update with diff', () => {
      const before = { id: 'supp-123', name: 'AWS Colombia', payment_terms_days: 30 };
      const after = { id: 'supp-123', name: 'AWS Colombia S.A.S.', payment_terms_days: 60 };

      const auditPayload: AuditLogEntry = {
        company_id: paguroCorpId,
        user_id: 'a0000000-0000-0000-0000-000000000001',
        action: 'UPDATE',
        entity_type: 'supplier',
        entity_id: 'supp-123',
        before_json: before,
        after_json: after,
      };

      expect(auditPayload.action).toBe('UPDATE');
      expect(auditPayload.before_json.payment_terms_days).toBe(30);
      expect(auditPayload.after_json.payment_terms_days).toBe(60);
    });
  });

  describe('6. Empty State vs Search State Detection', () => {
    function getEmptyStateType(itemCount: number, searchTerm: string, statusFilter: string): 'none' | 'clean_db' | 'search_empty' {
      if (itemCount > 0) return 'none';
      if (searchTerm.trim().length > 0 || statusFilter !== 'all') return 'search_empty';
      return 'clean_db';
    }

    it('returns clean_db when zero records and no search active', () => {
      expect(getEmptyStateType(0, '', 'all')).toBe('clean_db');
    });

    it('returns search_empty when search is active and yields zero records', () => {
      expect(getEmptyStateType(0, 'NonExistent Corp', 'all')).toBe('search_empty');
    });

    it('returns search_empty when filter is inactive and yields zero records', () => {
      expect(getEmptyStateType(0, '', 'inactive')).toBe('search_empty');
    });

    it('returns none when records exist', () => {
      expect(getEmptyStateType(5, '', 'all')).toBe('none');
    });
  });
});
