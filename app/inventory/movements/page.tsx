'use client';

// ============================================================================
// Paguro Finance - Inventory Movement Ledger (Supabase-backed Operational History)
// Movement-based authoritative ledger, negative stock policy, audit trail
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  InventoryMovementWithDetails,
  InventoryMovementType,
  ProductWithStock,
  RecordMovementInput,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  getInventoryMovementsAction,
  recordInventoryMovementAction,
} from '@/lib/actions/inventory';
import { getProductsAction } from '@/lib/actions/products';
import {
  getMovementDirection,
  validateInventoryMovement,
} from '@/lib/finance/inventory';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];

const MOVEMENT_TYPES: { value: InventoryMovementType; label: string; direction: 'in' | 'out' }[] = [
  { value: 'PURCHASE', label: 'Compra a Proveedor (Entrada +)', direction: 'in' },
  { value: 'RETURN_IN', label: 'Devolución de Cliente (Entrada +)', direction: 'in' },
  { value: 'ADJUSTMENT_IN', label: 'Ajuste de Conteo Físico (Sobrante +)', direction: 'in' },
  { value: 'TRANSFER_IN', label: 'Transferencia Entrante (Entrada +)', direction: 'in' },
  { value: 'SALE', label: 'Venta a Cliente (Salida -)', direction: 'out' },
  { value: 'RETURN_OUT', label: 'Devolución a Proveedor (Salida -)', direction: 'out' },
  { value: 'ADJUSTMENT_OUT', label: 'Ajuste de Conteo Físico (Faltante -)', direction: 'out' },
  { value: 'DAMAGED', label: 'Merma / Producto Dañado (Salida -)', direction: 'out' },
  { value: 'TRANSFER_OUT', label: 'Transferencia Saliente (Salida -)', direction: 'out' },
];

export default function InventoryMovementsPage() {
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // User Role
  const [userRole, setUserRole] = useState<string | null>(null);
  const canWrite = userRole ? WRITE_ROLES.includes(userRole) : false;

  // Form state
  const [formData, setFormData] = useState<RecordMovementInput>({
    product_id: '',
    movement_type: 'ADJUSTMENT_IN',
    quantity: 1,
    unit_cost: 0,
    reason: '',
  });

  // Resolve user role
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from('company_users')
        .select('role')
        .eq('user_id', user.id)
        .in('status', ['active', 'ACTIVE'])
        .single();
      if (membership) {
        setUserRole(membership.role);
      }
    });
  }, []);

  // Fetch available products for filter and modal
  const loadProducts = useCallback(async () => {
    const res = await getProductsAction();
    if (res.success && res.data) {
      const physicalOnly = res.data.filter((p) => p.is_inventory_item);
      setProducts(physicalOnly);
      if (physicalOnly.length > 0) {
        setFormData((prev) => (prev.product_id ? prev : {
          ...prev,
          product_id: physicalOnly[0].id,
          unit_cost: physicalOnly[0].cost,
        }));
      }
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load movements ledger
  const loadMovements = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await getInventoryMovementsAction(productFilter, typeFilter);
      if (res.success && res.data) {
        setMovements(res.data);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al cargar ledger de movimientos.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  }, [productFilter, typeFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Handle product selection in form to auto-update unit cost
  const handleProductChange = (newProductId: string) => {
    const selProd = products.find((p) => p.id === newProductId);
    setFormData({
      ...formData,
      product_id: newProductId,
      unit_cost: selProd ? selProd.cost : 0,
    });
  };

  // Real-time stock projection
  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const currentStock = selectedProduct ? selectedProduct.current_stock : 0;
  const direction = getMovementDirection(formData.movement_type);
  const qtyDelta = direction * Math.abs(Number(formData.quantity) || 0);
  const validation = validateInventoryMovement(currentStock, qtyDelta, false);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.error || 'Operación inválida.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await recordInventoryMovementAction(formData);
      if (res.success && res.data) {
        setFeedback({ type: 'success', message: res.message || 'Movimiento registrado con éxito.' });
        setIsModalOpen(false);
        setFormData({
          product_id: products[0]?.id || '',
          movement_type: 'ADJUSTMENT_IN',
          quantity: 1,
          unit_cost: products[0]?.cost || 0,
          reason: '',
        });
        loadMovements();
        loadProducts(); // refresh products stock
      } else {
        setFeedback({ type: 'error', message: res.error || 'Error al registrar movimiento.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error inesperado.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)', margin: 0 }}>
            Ledger de Movimientos de Inventario
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
            Historial inmutable de transacciones. Registro auditable de entradas, salidas, mermas y ajustes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            icon={<RefreshCw size={15} />}
            onClick={() => loadMovements()}
            disabled={loading}
          >
            Actualizar
          </Button>

          {canWrite && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setFeedback(null);
                setIsModalOpen(true);
              }}
            >
              Registrar Movimiento
            </Button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: '240px' }}>
          <select
            className="form-input"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="all">Filtrar por Producto: Todos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} - {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '220px' }}>
          <select
            className="form-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Tipo de Movimiento: Todos</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / Clean Empty State */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando ledger desde Supabase...</p>
        </div>
      ) : movements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-primary)',
              marginBottom: '16px',
            }}
          >
            <Layers size={28} />
          </div>
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
            {productFilter !== 'all' || typeFilter !== 'all'
              ? 'No se encontraron movimientos con los filtros seleccionados'
              : 'No hay movimientos registrados en el ledger'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '440px', margin: '0 auto 20px' }}>
            {productFilter !== 'all' || typeFilter !== 'all'
              ? 'Intente seleccionar otro producto o restablecer los filtros de búsqueda.'
              : 'El inventario de producción se encuentra en estado inicial. Registre una entrada de stock para comenzar a trazar las existencias.'}
          </p>
          {canWrite && productFilter === 'all' && typeFilter === 'all' && products.length > 0 && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setFeedback(null);
                setIsModalOpen(true);
              }}
            >
              Registrar Primer Movimiento
            </Button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha & Hora</th>
                <th>Producto (SKU)</th>
                <th>Tipo de Movimiento</th>
                <th>Variación (Delta)</th>
                <th>Costo Unitario</th>
                <th>Impacto Valoración</th>
                <th>Motivo / Referencia</th>
                <th>Registrado Por</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isPositive = m.quantity_delta > 0;
                const impactValue = Math.abs(m.quantity_delta * m.unit_cost);
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text-white)', fontWeight: 500 }}>
                        {formatDateTime(m.movement_date)}
                      </div>
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontWeight: 700, color: 'var(--text-white)' }}>
                        {m.product?.sku || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {m.product?.name || 'Producto no disponible'}
                      </div>
                    </td>
                    <td>
                      <Badge status={isPositive ? 'completed' : 'damaged'} label={m.movement_type} />
                    </td>
                    <td>
                      <span
                        className="num-mono"
                        style={{
                          fontWeight: 700,
                          fontSize: '14px',
                          color: isPositive ? '#10b981' : '#ef4444',
                        }}
                      >
                        {isPositive ? `+${m.quantity_delta}` : `${m.quantity_delta}`}
                      </span>
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {formatCurrency(m.unit_cost)}
                      </div>
                    </td>
                    <td>
                      <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                        {formatCurrency(impactValue)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {m.reason || 'Sin observación'}
                      </div>
                      {m.source_type && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                          Origen: {m.source_type}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {m.created_by_profile?.full_name || 'Sistema'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Registrar Movimiento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Transacción en Ledger de Inventario"
      >
        <form onSubmit={handleRecordSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label">Producto Físico *</label>
            <select
              className="form-input"
              required
              value={formData.product_id}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} (Stock actual: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          {/* Current Stock Banner */}
          {selectedProduct && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-card)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Stock Disponible</span>
                <div className="num-mono" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
                  {selectedProduct.current_stock} unidades
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Costo Unitario Base</span>
                <div className="num-mono" style={{ fontSize: '14px', color: '#10b981' }}>
                  {formatCurrency(selectedProduct.cost)}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Tipo de Movimiento *</label>
              <select
                className="form-input"
                required
                value={formData.movement_type}
                onChange={(e) => setFormData({ ...formData, movement_type: e.target.value as InventoryMovementType })}
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Cantidad a Mover *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-input"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, Number(e.target.value)) })}
              />
            </div>
          </div>

          {/* Live Projection Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              backgroundColor: validation.valid ? 'rgba(59, 130, 246, 0.08)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${validation.valid ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.35)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '12px', color: validation.valid ? 'var(--text-muted)' : '#ef4444' }}>
              {validation.valid ? (
                <span>
                  Variación: <strong style={{ color: qtyDelta > 0 ? '#10b981' : '#ef4444' }}>{qtyDelta > 0 ? `+${qtyDelta}` : qtyDelta}</strong> &rarr; Stock resultante: <strong>{validation.projectedStock}</strong>
                </span>
              ) : (
                <span>{validation.error}</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label className="form-label">Costo Unitario Aplicado (COP)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="form-label">Motivo / Documento de Referencia</label>
              <input
                type="text"
                className="form-input"
                placeholder="ej. Factura Compra FAC-99, Ajuste anual..."
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={submitting || !validation.valid}>
              {submitting ? 'Procesando...' : 'Confirmar Transacción'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
