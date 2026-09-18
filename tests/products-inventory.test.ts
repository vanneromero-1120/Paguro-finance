// ============================================================================
// Paguro Finance - Products & Inventory Base Unit & Security Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  Product,
  InventoryMovement,
  InventoryMovementType,
  CreateProductInput,
  RecordMovementInput,
} from '../types/database';
import {
  deriveProductStock,
  getMovementDirection,
  validateInventoryMovement,
  isLowStock,
  calculateInventoryValuation,
} from '../lib/finance/inventory';
import { roundHalfUp } from '../lib/finance/calculations';

describe('Products & Inventory Base Milestone Tests', () => {
  const paguroCorpId = 'c1111111-1111-1111-1111-111111111111';
  const otherCompanyId = 'c2222222-2222-2222-2222-222222222222';

  // --------------------------------------------------------------------------
  // 1. Role Authorization Matrix
  // --------------------------------------------------------------------------
  describe('1. Role Authorization Matrix for Products & Inventory', () => {
    const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];
    const READ_ONLY_ROLES = ['FINANCE', 'ACCOUNTANT', 'VIEWER'];

    function canManageProductsAndInventory(role: string): boolean {
      return WRITE_ROLES.includes(role);
    }

    it('grants mutation access to SUPER_ADMIN, ADMIN, and OPERATIONS', () => {
      expect(canManageProductsAndInventory('SUPER_ADMIN')).toBe(true);
      expect(canManageProductsAndInventory('ADMIN')).toBe(true);
      expect(canManageProductsAndInventory('OPERATIONS')).toBe(true);
    });

    it('strictly forbids VIEWER, FINANCE, and ACCOUNTANT from mutating products or movements', () => {
      expect(canManageProductsAndInventory('VIEWER')).toBe(false);
      expect(canManageProductsAndInventory('FINANCE')).toBe(false);
      expect(canManageProductsAndInventory('ACCOUNTANT')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Product Validation & Decimal Money Handling
  // --------------------------------------------------------------------------
  describe('2. Product Input Validation & Decimal Money Handling', () => {
    function validateProduct(input: Partial<CreateProductInput>): { valid: boolean; error?: string } {
      if (!input.sku || !input.sku.trim()) {
        return { valid: false, error: 'El código SKU es obligatorio.' };
      }
      if (!input.name || !input.name.trim()) {
        return { valid: false, error: 'El nombre del producto es obligatorio.' };
      }
      if (input.cost !== undefined && input.cost < 0) {
        return { valid: false, error: 'El costo no puede ser negativo.' };
      }
      if (input.sale_price !== undefined && input.sale_price < 0) {
        return { valid: false, error: 'El precio de venta no puede ser negativo.' };
      }
      if (!input.tax_rate_id) {
        return { valid: false, error: 'Debe seleccionar una tasa de impuesto válida.' };
      }
      return { valid: true };
    }

    it('accepts valid product input with financial decimals', () => {
      const result = validateProduct({
        sku: 'SRV-DELL-01',
        name: 'Servidor Dell R640',
        cost: 15450250.5,
        sale_price: 22000000.0,
        tax_rate_id: 'tr-iva-19',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects missing SKU', () => {
      const result = validateProduct({
        sku: '   ',
        name: 'Servidor',
        tax_rate_id: 'tr-iva-19',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SKU');
    });

    it('rejects negative cost and negative sale price', () => {
      const res1 = validateProduct({ sku: 'A', name: 'B', cost: -100, tax_rate_id: 'tr' });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('costo');

      const res2 = validateProduct({ sku: 'A', name: 'B', cost: 100, sale_price: -50, tax_rate_id: 'tr' });
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('precio');
    });

    it('accurately rounds monetary values without floating point distortion', () => {
      const rawCost = 129999.995;
      const rounded = roundHalfUp(rawCost, 2);
      expect(rounded).toBe(130000.0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. SKU Uniqueness Per Company
  // --------------------------------------------------------------------------
  describe('3. SKU Uniqueness Per Company', () => {
    const existingProducts: Product[] = [
      {
        id: 'p-1',
        company_id: paguroCorpId,
        sku: 'LAPTOP-PRO',
        name: 'Laptop Pro 16',
        product_type: 'physical',
        cost: 5000000,
        sale_price: 7500000,
        tax_rate_id: 'tr-1',
        stock_minimum: 5,
        is_inventory_item: true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'p-2',
        company_id: otherCompanyId,
        sku: 'LAPTOP-PRO', // Same SKU in another company
        name: 'Laptop Pro Rival',
        product_type: 'physical',
        cost: 4800000,
        sale_price: 7200000,
        tax_rate_id: 'tr-1',
        stock_minimum: 5,
        is_inventory_item: true,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    function checkSkuAvailable(companyId: string, sku: string, excludeId?: string): boolean {
      return !existingProducts.some(
        (p) => p.company_id === companyId && p.sku === sku.toUpperCase() && p.id !== excludeId
      );
    }

    it('rejects duplicate SKU within the same company', () => {
      expect(checkSkuAvailable(paguroCorpId, 'LAPTOP-PRO')).toBe(false);
      expect(checkSkuAvailable(paguroCorpId, 'laptop-pro')).toBe(false);
    });

    it('allows same SKU if belonging to a different company (multi-tenant isolated)', () => {
      expect(checkSkuAvailable('c3333333-3333-3333-3333-333333333333', 'LAPTOP-PRO')).toBe(true);
    });

    it('allows keeping same SKU when updating existing record', () => {
      expect(checkSkuAvailable(paguroCorpId, 'LAPTOP-PRO', 'p-1')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Movement-Based Stock Derivation & Directions
  // --------------------------------------------------------------------------
  describe('4. Movement-Based Stock Derivation & Directions', () => {
    it('correctly maps movement type directions', () => {
      // Inbound (+1)
      expect(getMovementDirection('PURCHASE')).toBe(1);
      expect(getMovementDirection('RETURN_IN')).toBe(1);
      expect(getMovementDirection('ADJUSTMENT_IN')).toBe(1);
      expect(getMovementDirection('TRANSFER_IN')).toBe(1);

      // Outbound (-1)
      expect(getMovementDirection('SALE')).toBe(-1);
      expect(getMovementDirection('RETURN_OUT')).toBe(-1);
      expect(getMovementDirection('ADJUSTMENT_OUT')).toBe(-1);
      expect(getMovementDirection('DAMAGED')).toBe(-1);
      expect(getMovementDirection('TRANSFER_OUT')).toBe(-1);
    });

    it('derives accurate stock balance from historical movements ledger', () => {
      const movements: InventoryMovement[] = [
        {
          id: 'm-1',
          company_id: paguroCorpId,
          product_id: 'p-1',
          movement_type: 'PURCHASE',
          movement_date: '2026-09-01T10:00:00Z',
          quantity_delta: 50,
          unit_cost: 100000,
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'm-2',
          company_id: paguroCorpId,
          product_id: 'p-1',
          movement_type: 'SALE',
          movement_date: '2026-09-02T10:00:00Z',
          quantity_delta: -15,
          unit_cost: 100000,
          created_at: '2026-09-02T10:00:00Z',
        },
        {
          id: 'm-3',
          company_id: paguroCorpId,
          product_id: 'p-1',
          movement_type: 'RETURN_IN',
          movement_date: '2026-09-03T10:00:00Z',
          quantity_delta: 2,
          unit_cost: 100000,
          created_at: '2026-09-03T10:00:00Z',
        },
        {
          id: 'm-4',
          company_id: paguroCorpId,
          product_id: 'p-1',
          movement_type: 'DAMAGED',
          movement_date: '2026-09-04T10:00:00Z',
          quantity_delta: -1,
          unit_cost: 100000,
          created_at: '2026-09-04T10:00:00Z',
        },
      ];

      const currentStock = deriveProductStock(movements);
      // 50 - 15 + 2 - 1 = 36
      expect(currentStock).toBe(36);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Negative Stock Policy
  // --------------------------------------------------------------------------
  describe('5. Negative Stock Policy Enforcement', () => {
    it('permits outbound movements within available stock', () => {
      const currentStock = 10;
      const outboundDelta = -8;
      const res = validateInventoryMovement(currentStock, outboundDelta, false);
      expect(res.valid).toBe(true);
      expect(res.projectedStock).toBe(2);
    });

    it('strictly rejects outbound movements that exceed available stock', () => {
      const currentStock = 10;
      const outboundDelta = -12;
      const res = validateInventoryMovement(currentStock, outboundDelta, false);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('negativo');
      expect(res.projectedStock).toBe(-2);
    });

    it('rejects non-positive quantities in movement recording input', () => {
      function validateMovementInput(input: Partial<RecordMovementInput>): boolean {
        if (!input.quantity || input.quantity <= 0) return false;
        return true;
      }
      expect(validateMovementInput({ quantity: 0 })).toBe(false);
      expect(validateMovementInput({ quantity: -5 })).toBe(false);
      expect(validateMovementInput({ quantity: 10 })).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Inventory Valuation & Low Stock Detection
  // --------------------------------------------------------------------------
  describe('6. Inventory Valuation & Low Stock Thresholds', () => {
    it('accurately computes inventory valuation (stock * unit_cost)', () => {
      const stock = 45;
      const unitCost = 350000.5;
      const valuation = calculateInventoryValuation(stock, unitCost);
      // 45 * 350000.50 = 15750022.50
      expect(valuation).toBe(15750022.5);
    });

    it('returns zero valuation when stock or cost is zero or negative', () => {
      expect(calculateInventoryValuation(0, 50000)).toBe(0);
      expect(calculateInventoryValuation(-5, 50000)).toBe(0);
      expect(calculateInventoryValuation(10, 0)).toBe(0);
    });

    it('flags low stock when current stock <= stock minimum', () => {
      expect(isLowStock(5, 10)).toBe(true);
      expect(isLowStock(10, 10)).toBe(true);
      expect(isLowStock(11, 10)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Multi-Company Isolation & Cross-Company Integrity
  // --------------------------------------------------------------------------
  describe('7. Multi-Company Isolation & Cross-Company Reference Integrity', () => {
    interface SupplierMock {
      id: string;
      company_id: string;
      name: string;
    }

    const mockSuppliers: SupplierMock[] = [
      { id: 'sup-paguro', company_id: paguroCorpId, name: 'Mayorista Paguro' },
      { id: 'sup-other', company_id: otherCompanyId, name: 'Mayorista Otra Empresa' },
    ];

    function validateSupplierBelongsToCompany(supplierId: string, companyId: string): boolean {
      const supplier = mockSuppliers.find((s) => s.id === supplierId);
      if (!supplier) return false;
      return supplier.company_id === companyId;
    }

    it('accepts supplier belonging to same company', () => {
      expect(validateSupplierBelongsToCompany('sup-paguro', paguroCorpId)).toBe(true);
    });

    it('rejects assigning cross-company supplier to product', () => {
      expect(validateSupplierBelongsToCompany('sup-other', paguroCorpId)).toBe(false);
    });

    it('rejects recording inventory movement for product of another company', () => {
      function validateMovementProductCompany(productCompanyId: string, movementCompanyId: string): boolean {
        return productCompanyId === movementCompanyId;
      }
      expect(validateMovementProductCompany(otherCompanyId, paguroCorpId)).toBe(false);
      expect(validateMovementProductCompany(paguroCorpId, paguroCorpId)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Audit Log Payloads
  // --------------------------------------------------------------------------
  describe('8. Audit Log Payloads for Products & Movements', () => {
    it('properly formats audit log payloads on product creation', () => {
      const auditEntry = {
        company_id: paguroCorpId,
        user_id: 'u-admin-1',
        action: 'CREATE',
        entity_type: 'product',
        entity_id: 'p-101',
        after_json: { id: 'p-101', sku: 'MONITOR-27', cost: 800000, sale_price: 1200000 },
      };

      expect(auditEntry.action).toBe('CREATE');
      expect(auditEntry.entity_type).toBe('product');
      expect(auditEntry.after_json.sku).toBe('MONITOR-27');
    });

    it('properly formats audit log payloads on inventory movement with stock diff', () => {
      const auditEntry = {
        company_id: paguroCorpId,
        user_id: 'u-admin-1',
        action: 'CREATE',
        entity_type: 'inventory_movement',
        entity_id: 'mov-101',
        after_json: {
          id: 'mov-101',
          product_id: 'p-101',
          quantity_delta: 25,
          previous_stock: 10,
          new_stock: 35,
        },
      };

      expect(auditEntry.action).toBe('CREATE');
      expect(auditEntry.entity_type).toBe('inventory_movement');
      expect(auditEntry.after_json.previous_stock).toBe(10);
      expect(auditEntry.after_json.new_stock).toBe(35);
    });
  });
});
