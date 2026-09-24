'use client';

// ============================================================================
// Paguro Finance V1 - Normalized Financial Movements Ledger
// Comprehensive filtering, Detail Drawer, Duplicate Guard & Manual Entry
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Landmark,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  getFinancialMovementsAction,
  createFinancialMovementAction,
  updateMovementReviewStatusAction,
  getMovementCategoriesAction,
  MovementFilterInput,
  CreateMovementInput,
} from '@/lib/actions/movements';
import { FinancialMovement, MovementCategory } from '@/types/v1-financial';

export default function MovementsPage() {
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<MovementFilterInput>({
    direction: 'ALL',
    category_id: 'ALL',
    source_type: 'ALL',
    tax_relevance: 'ALL',
    review_status: 'ALL',
    search: '',
  });

  // Selected movement for detail drawer
  const [selectedMovement, setSelectedMovement] = useState<FinancialMovement | null>(null);

  // New Movement Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalWarning, setModalWarning] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateMovementInput>({
    movement_date: new Date().toISOString().split('T')[0],
    direction: 'EXPENSE',
    source_type: 'MANUAL',
    description: '',
    counterparty: '',
    counterparty_tax_id: '',
    original_amount: 0,
    currency: 'COP',
    exchange_rate: 1,
    tax_relevance: 'TAXABLE',
  });

  const loadMovements = useCallback(async () => {
    setLoading(true);
    const res = await getFinancialMovementsAction(filters);
    if (res.success && res.data) {
      setMovements(res.data);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    getMovementCategoriesAction().then((res) => {
      if (res.success && res.data) setCategories(res.data);
    });
  }, []);

  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalWarning(null);

    const res = await createFinancialMovementAction(formData);
    if (res.success && res.data) {
      if (res.warning) {
        setModalWarning(res.warning);
      } else {
        setIsModalOpen(false);
        setFormData({
          movement_date: new Date().toISOString().split('T')[0],
          direction: 'EXPENSE',
          source_type: 'MANUAL',
          description: '',
          counterparty: '',
          counterparty_tax_id: '',
          original_amount: 0,
          currency: 'COP',
          exchange_rate: 1,
          tax_relevance: 'TAXABLE',
        });
      }
      loadMovements();
    } else {
      alert(res.error || 'Error al registrar el movimiento.');
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (status: 'CONFIRMED' | 'RESOLVED' | 'FLAGGED') => {
    if (!selectedMovement) return;
    await updateMovementReviewStatusAction(selectedMovement.id, status);
    setSelectedMovement({ ...selectedMovement, review_status: status });
    loadMovements();
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Movimientos Financieros</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Ledger central normalizado: banco, pasarelas, documentos y registros manuales
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setModalWarning(null);
            setIsModalOpen(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--paguro-blue)' }}
        >
          <Plus size={16} />
          <span>Registrar Movimiento</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 220px', minWidth: '180px', position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Buscar por descripción o tercero..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>

        {/* Direction */}
        <div style={{ width: '140px' }}>
          <select
            className="form-select"
            value={filters.direction}
            onChange={(e) => setFilters({ ...filters, direction: e.target.value as any })}
          >
            <option value="ALL">Todo Flujo</option>
            <option value="INCOME">Ingresos (+)</option>
            <option value="EXPENSE">Egresos (-)</option>
          </select>
        </div>

        {/* Category */}
        <div style={{ width: '180px' }}>
          <select
            className="form-select"
            value={filters.category_id}
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
          >
            <option value="ALL">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div style={{ width: '150px' }}>
          <select
            className="form-select"
            value={filters.source_type}
            onChange={(e) => setFilters({ ...filters, source_type: e.target.value as any })}
          >
            <option value="ALL">Todos los Orígenes</option>
            <option value="BANK">Banco</option>
            <option value="PAYMENT_PLATFORM">Pasarela</option>
            <option value="ACCOUNTING_DOCUMENT">Documento</option>
            <option value="MANUAL">Manual</option>
            <option value="IMPORT">Importación</option>
          </select>
        </div>

        {/* Review Status */}
        <div style={{ width: '160px' }}>
          <select
            className="form-select"
            value={filters.review_status}
            onChange={(e) => setFilters({ ...filters, review_status: e.target.value as any })}
          >
            <option value="ALL">Todos los Estados</option>
            <option value="CONFIRMED">Confirmado</option>
            <option value="REQUIRES_REVIEW">Requiere Revisión</option>
            <option value="FLAGGED">Marcado</option>
            <option value="RESOLVED">Resuelto</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Tercero / Contraparte</th>
                <th>Categoría</th>
                <th>Origen</th>
                <th>Tributario</th>
                <th>Revisión</th>
                <th style={{ textAlign: 'right' }}>Monto (COP)</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando movimientos financieros...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No se encontraron movimientos registrados con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedMovement(m)}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {m.movement_date}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{m.description}</div>
                      {m.external_reference && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Ref: {m.external_reference}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-dim)' }}>
                      <div>{m.counterparty || '—'}</div>
                      {m.counterparty_tax_id && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>NIT: {m.counterparty_tax_id}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {m.category?.name || 'General'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-brand-blue" style={{ fontSize: '9px' }}>
                        {m.source_type}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          m.tax_relevance === 'TAXABLE' ? 'badge-brand-pink' : 'badge-neutral'
                        }`}
                        style={{ fontSize: '9px' }}
                      >
                        {m.tax_relevance}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          m.review_status === 'CONFIRMED'
                            ? 'badge-success'
                            : m.review_status === 'REQUIRES_REVIEW'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                        style={{ fontSize: '9px' }}
                      >
                        {m.review_status}
                      </span>
                    </td>
                    <td
                      className="num-mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: m.direction === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.direction === 'INCOME' ? '+' : '-'} ${m.amount_cop.toLocaleString('es-CO')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMovement(m);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--paguro-blue)',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {selectedMovement && (
        <Modal
          isOpen={!!selectedMovement}
          onClose={() => setSelectedMovement(null)}
          title={`Detalle de Movimiento • ${selectedMovement.description}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header Stat */}
            <div
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Monto Normalizado COP
                </div>
                <div
                  className="num-mono"
                  style={{
                    fontSize: '24px',
                    fontWeight: 700,
                    color:
                      selectedMovement.direction === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  {selectedMovement.direction === 'INCOME' ? '+' : '-'} $
                  {selectedMovement.amount_cop.toLocaleString('es-CO')} COP
                </div>
                {selectedMovement.currency !== 'COP' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Original: {selectedMovement.original_amount} {selectedMovement.currency} (Tasa:{' '}
                    {selectedMovement.exchange_rate})
                  </div>
                )}
              </div>
              <span
                className={`badge ${
                  selectedMovement.direction === 'INCOME' ? 'badge-success' : 'badge-danger'
                }`}
              >
                {selectedMovement.direction}
              </span>
            </div>

            {/* Grid Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Fecha del Movimiento:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {selectedMovement.movement_date}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)' }}>Contraparte / Tercero:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {selectedMovement.counterparty || 'No especificado'}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)' }}>Categoría:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {selectedMovement.category?.name || 'General'}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)' }}>Origen del Registro:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {selectedMovement.source_type}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)' }}>Tratamiento Tributario:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {selectedMovement.tax_relevance} ({selectedMovement.tax_status})
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)' }}>Confianza de Extracción:</span>
                <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>
                  {(selectedMovement.confidence_score * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Linked Document & Bank */}
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 152, 255, 0.04)',
                border: '1px solid rgba(0, 152, 255, 0.15)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--paguro-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Trazabilidad & Soportes Vinculados
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedMovement.document ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="var(--color-success)" />
                    <span>Documento soporte: {selectedMovement.document.file_name}</span>
                  </div>
                ) : (
                  <div>Sin documento soporte adjunto (requiere revisión).</div>
                )}
              </div>
            </div>

            {/* Actions for Human Review */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
              {selectedMovement.review_status !== 'CONFIRMED' && (
                <Button
                  variant="primary"
                  onClick={() => handleUpdateStatus('CONFIRMED')}
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  <CheckCircle2 size={14} />
                  <span>Confirmar Validez</span>
                </Button>
              )}
              {selectedMovement.review_status !== 'FLAGGED' && (
                <Button
                  variant="secondary"
                  onClick={() => handleUpdateStatus('FLAGGED')}
                  style={{ color: 'var(--color-danger)' }}
                >
                  <AlertTriangle size={14} />
                  <span>Marcar para Revisión</span>
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE MOVEMENT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nuevo Movimiento Financiero"
      >
        <form onSubmit={handleCreateMovement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {modalWarning && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--color-warning)',
                fontSize: '12px',
              }}
            >
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
              {modalWarning}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Dirección del Flujo</label>
              <select
                className="form-select"
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
              >
                <option value="EXPENSE">Egreso / Gasto (-)</option>
                <option value="INCOME">Ingreso / Venta (+)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                type="date"
                required
                className="form-input"
                value={formData.movement_date}
                onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej: Suscripción mensual AWS Cloud"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tercero / Proveedor / Cliente</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nombre de la empresa o persona"
                value={formData.counterparty || ''}
                onChange={(e) => setFormData({ ...formData, counterparty: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">NIT / Documento</label>
              <input
                type="text"
                className="form-input"
                placeholder="900.000.000-0"
                value={formData.counterparty_tax_id || ''}
                onChange={(e) => setFormData({ ...formData, counterparty_tax_id: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-input"
                placeholder="0.00"
                value={formData.original_amount || ''}
                onChange={(e) => setFormData({ ...formData, original_amount: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select
                className="form-select"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="COP">COP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select
                className="form-select"
                value={formData.category_id || ''}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">Seleccione una categoría...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Relevancia Fiscal</label>
              <select
                className="form-select"
                value={formData.tax_relevance}
                onChange={(e) => setFormData({ ...formData, tax_relevance: e.target.value as any })}
              >
                <option value="TAXABLE">Gravado (Aplica IVA/Renta)</option>
                <option value="NON_TAXABLE">No Gravado</option>
                <option value="EXEMPT">Exento</option>
                <option value="EXCLUDED">Excluido</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar Movimiento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
