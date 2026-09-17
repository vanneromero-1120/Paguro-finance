import { describe, it, expect } from 'vitest';
import {
  deriveProductStock,
  validateInventoryMovement,
  isLowStock,
  getMovementDirection,
} from '../lib/finance/inventory';
import { InventoryMovement } from '../types/database';

describe('Inventory Ledger & Movement Engine', () => {
  it('should accurately derive stock from historical movement ledger', () => {
    const movements: InventoryMovement[] = [
      {
        id: '1',
        company_id: 'c1',
        product_id: 'p1',
        movement_type: 'PURCHASE',
        movement_date: '2026-08-01',
        quantity_delta: 100,
        unit_cost: 1000,
        created_at: '2026-08-01',
      },
      {
        id: '2',
        company_id: 'c1',
        product_id: 'p1',
        movement_type: 'SALE',
        movement_date: '2026-08-02',
        quantity_delta: -25,
        unit_cost: 1000,
        created_at: '2026-08-02',
      },
      {
        id: '3',
        company_id: 'c1',
        product_id: 'p1',
        movement_type: 'RETURN_IN',
        movement_date: '2026-08-03',
        quantity_delta: 5,
        unit_cost: 1000,
        created_at: '2026-08-03',
      },
      {
        id: '4',
        company_id: 'c1',
        product_id: 'p1',
        movement_type: 'DAMAGED',
        movement_date: '2026-08-04',
        quantity_delta: -2,
        unit_cost: 1000,
        created_at: '2026-08-04',
      },
    ];

    const stock = deriveProductStock(movements);
    // 100 - 25 + 5 - 2 = 78
    expect(stock).toBe(78);
  });

  it('should prevent movement that results in negative stock when policy forbids', () => {
    const currentStock = 10;
    const quantityDelta = -15;

    const validation = validateInventoryMovement(currentStock, quantityDelta, false);

    expect(validation.valid).toBe(false);
    expect(validation.projectedStock).toBe(-5);
    expect(validation.error).toContain('stock en negativo');
  });

  it('should permit outbound movement if stock remains non-negative', () => {
    const currentStock = 10;
    const quantityDelta = -8;

    const validation = validateInventoryMovement(currentStock, quantityDelta, false);

    expect(validation.valid).toBe(true);
    expect(validation.projectedStock).toBe(2);
  });

  it('should detect low stock alerts when stock is at or below minimum', () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
  });

  it('should verify movement direction classifications', () => {
    expect(getMovementDirection('PURCHASE')).toBe(1);
    expect(getMovementDirection('RETURN_IN')).toBe(1);
    expect(getMovementDirection('ADJUSTMENT_IN')).toBe(1);
    expect(getMovementDirection('SALE')).toBe(-1);
    expect(getMovementDirection('DAMAGED')).toBe(-1);
    expect(getMovementDirection('ADJUSTMENT_OUT')).toBe(-1);
  });
});
