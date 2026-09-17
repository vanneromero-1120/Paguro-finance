'use client';

import React, { useState } from 'react';
import { Plus, ArrowUpDown, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_PRODUCTS, INITIAL_MOVEMENTS } from '@/lib/supabase/mock-store';
import { InventoryMovement, InventoryMovementType } from '@/types/database';
import {
  deriveProductStock,
  getMovementDirection,
  validateInventoryMovement,
} from '@/lib/finance/inventory';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>(INITIAL_MOVEMENTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [productId, setProductId] = useState(INITIAL_PRODUCTS[0]?.id || '');
  const [movementType, setMovementType] = useState<InventoryMovementType>('ADJUSTMENT_IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reason, setReason] = useState<string>('');

  const physicalProducts = INITIAL_PRODUCTS.filter((p) => p.is_inventory_item);

  const handleRecordMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const productMovements = movements.filter((m) => m.product_id === productId);
    const currentStock = deriveProductStock(productMovements);
    const direction = getMovementDirection(movementType);
    const quantityDelta = direction * Math.abs(quantity);

    // Business rule validation: negative stock check
    const check = validateInventoryMovement(currentStock, quantityDelta, false);
    if (!check.valid) {
      setErrorMsg(check.error || 'Operación inválida');
      return;
    }

    const newMovement: InventoryMovement = {
      id: `im-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      product_id: productId,
      movement_type: movementType,
      movement_date: new Date().toISOString(),
      quantity_delta: quantityDelta,
      unit_cost: Number(unitCost),
      source_type: 'manual_adjustment',
      reason,
      created_at: new Date().toISOString(),
    };

    setMovements([newMovement, ...movements]);
    setIsModalOpen(false);
    setQuantity(1);
    setReason('');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Ledger de Movimientos de Inventario
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro cronológico inmutable de entradas, salidas, mermas y ajustes de stock.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setErrorMsg(null);
            setIsModalOpen(true);
          }}
        >
          Registrar Movimiento
        </Button>
      </div>

      {/* Movements Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha & Hora</th>
              <th>Producto (SKU)</th>
              <th>Tipo de Movimiento</th>
              <th>Variación (Delta)</th>
              <th>Costo Unit.</th>
              <th>Motivo / Referencia</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const product = INITIAL_PRODUCTS.find((p) => p.id === m.product_id);
              const isPositive = m.quantity_delta > 0;

              return (
                <tr key={m.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDateTime(m.movement_date)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {product?.name || 'Producto Desconocido'}
                    </div>
                    <div className="num-mono" style={{ fontSize: '11px', color: 'var(--color-primary)' }}>
                      {product?.sku}
                    </div>
                  </td>
                  <td>
                    <Badge status={m.movement_type} />
                  </td>
                  <td>
                    <span
                      className="num-mono"
                      style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: isPositive ? '#34d399' : '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isPositive ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      {isPositive ? `+${m.quantity_delta}` : `${m.quantity_delta}`}
                    </span>
                  </td>
                  <td className="num-mono" style={{ fontSize: '12px' }}>
                    {m.unit_cost > 0 ? formatCurrency(m.unit_cost) : '-'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {m.reason || m.source_type || 'Ajuste operativo'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Record Movement */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Movimiento de Inventario"
      >
        <form onSubmit={handleRecordMovement}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Producto Físico *</label>
            <select
              className="form-select"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {physicalProducts.map((p) => {
                const stock = deriveProductStock(movements.filter((m) => m.product_id === p.id));
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) - Stock actual: {stock}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Movimiento *</label>
              <select
                className="form-select"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as InventoryMovementType)}
              >
                <option value="PURCHASE">Compra (Entrada +)</option>
                <option value="RETURN_IN">Devolución Cliente (Entrada +)</option>
                <option value="ADJUSTMENT_IN">Ajuste Físico (Entrada +)</option>
                <option value="SALE">Venta (Salida -)</option>
                <option value="RETURN_OUT">Devolución Proveedor (Salida -)</option>
                <option value="ADJUSTMENT_OUT">Ajuste Físico (Salida -)</option>
                <option value="DAMAGED">Merma / Avería (Salida -)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                className="form-input"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Costo Unitario (COP)</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo o Justificación *</label>
            <textarea
              required
              rows={3}
              className="form-textarea"
              placeholder="Explique la causa del movimiento o ajuste..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Guardar Movimiento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
