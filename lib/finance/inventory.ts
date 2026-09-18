// ============================================================================
// Paguro Finance - Inventory Ledger Engine
// Stock is strictly derived by summing historical movements.
// ============================================================================

import { InventoryMovement, InventoryMovementType } from '@/types/database';
import { roundHalfUp } from './calculations';

/**
 * Derives current stock of a product from an array of inventory movements.
 */
export function deriveProductStock(
  movements: Array<{ quantity_delta?: number | null } | InventoryMovement>
): number {
  let stock = 0;
  for (const m of movements) {
    stock += Number(m.quantity_delta || 0);
  }
  return roundHalfUp(stock, 4);
}

/**
 * Returns whether a movement type naturally adds to or subtracts from stock.
 */
export function getMovementDirection(type: InventoryMovementType): 1 | -1 {
  switch (type) {
    case 'PURCHASE':
    case 'RETURN_IN':
    case 'ADJUSTMENT_IN':
    case 'TRANSFER_IN':
      return 1;
    case 'SALE':
    case 'RETURN_OUT':
    case 'ADJUSTMENT_OUT':
    case 'DAMAGED':
    case 'TRANSFER_OUT':
      return -1;
  }
}

/**
 * Validates whether an outbound movement would cause negative stock.
 */
export function validateInventoryMovement(
  currentStock: number,
  quantityDelta: number,
  allowNegativeStock: boolean = false
): { valid: boolean; error?: string; projectedStock: number } {
  const projectedStock = roundHalfUp(currentStock + quantityDelta, 4);
  if (!allowNegativeStock && projectedStock < 0) {
    return {
      valid: false,
      error: `La operación dejaría el stock en negativo (${projectedStock}). Stock actual disponible: ${currentStock}.`,
      projectedStock,
    };
  }
  return { valid: true, projectedStock };
}

/**
 * Checks if stock is at or below minimum threshold.
 */
export function isLowStock(currentStock: number, minimumStock: number): boolean {
  return currentStock <= minimumStock;
}

/**
 * Calculates financial inventory valuation.
 * Valuation = current_stock * unit_cost, rounded half-up to 2 currency decimals.
 */
export function calculateInventoryValuation(currentStock: number, unitCost: number): number {
  if (currentStock <= 0 || unitCost <= 0) return 0;
  return roundHalfUp(currentStock * unitCost, 2);
}
