'use client';

// ============================================================================
// Paguro Finance V1 - Tax Obligations Calendar & Compliance Tracking
// Status Workflows (PREPARED, FILED, PAID), Evidence Linkage & Audit Trail
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  CalendarCheck,
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  getTaxObligationsAction,
  createTaxObligationAction,
  updateTaxObligationStatusAction,
  getCompanyTaxProfileAction,
  isTaxProfileComplete,
} from '@/lib/actions/tax-operations';
import { TaxObligation, TaxObligationStatus, CompanyTaxProfile } from '@/types/v1-financial';

export default function ObligationsPage() {
  const [obligations, setObligations] = useState<TaxObligation[]>([]);
  const [taxProfile, setTaxProfile] = useState<CompanyTaxProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [taxTypeFilter, setTaxTypeFilter] = useState('ALL');

  // New Obligation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    tax_type: 'IVA',
    period: '2026-B1',
    due_date: new Date().toISOString().split('T')[0],
    estimated_amount: 0,
    notes: '',
  });

  // Action status modal
  const [actionTarget, setActionTarget] = useState<TaxObligation | null>(null);
  const [newStatus, setNewStatus] = useState<TaxObligationStatus>('PAID');
  const [actualAmount, setActualAmount] = useState<number>(0);
  const [statusNotes, setStatusNotes] = useState<string>('');

  const loadObligations = useCallback(async () => {
    setLoading(true);
    const [obRes, profRes] = await Promise.all([
      getTaxObligationsAction(taxTypeFilter),
      getCompanyTaxProfileAction(),
    ]);
    if (obRes.success && obRes.data) {
      setObligations(obRes.data);
    }
    if (profRes.success && profRes.data) {
      setTaxProfile(profRes.data);
    }
    setLoading(false);
  }, [taxTypeFilter]);

  useEffect(() => {
    loadObligations();
  }, [loadObligations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await createTaxObligationAction(form);
    if (res.success) {
      setIsModalOpen(false);
      setForm({
        name: '',
        tax_type: 'IVA',
        period: '2026-B1',
        due_date: new Date().toISOString().split('T')[0],
        estimated_amount: 0,
        notes: '',
      });
      loadObligations();
    } else {
      alert(res.error || 'Error al crear la obligación.');
    }
    setSaving(false);
  };

  const handleOpenStatusModal = (ob: TaxObligation, status: TaxObligationStatus) => {
    setActionTarget(ob);
    setNewStatus(status);
    setActualAmount(Number(ob.actual_amount || ob.estimated_amount));
    setStatusNotes('');
  };

  const handleConfirmStatus = async () => {
    if (!actionTarget) return;
    await updateTaxObligationStatusAction(
      actionTarget.id,
      newStatus,
      actualAmount,
      statusNotes
    );
    setActionTarget(null);
    loadObligations();
  };

  const getStatusBadge = (status: TaxObligationStatus) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success">Pagado</span>;
      case 'FILED':
        return <span className="badge badge-brand-blue">Presentado</span>;
      case 'PREPARED':
        return <span className="badge badge-warning">Preparado</span>;
      case 'OVERDUE':
        return <span className="badge badge-danger">Vencido</span>;
      case 'DUE_SOON':
        return <span className="badge badge-warning">Vence Pronto</span>;
      case 'DUE_TODAY':
        return <span className="badge badge-danger">Vence Hoy</span>;
      case 'UPCOMING':
      default:
        return <span className="badge badge-neutral">Próximo</span>;
    }
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
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Calendario & Obligaciones Tributarias</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Control de plazos, presentación, pago y evidencias de soporte tributario
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--paguro-blue)' }}
          >
            <Plus size={16} />
            <span>Programar Obligación</span>
          </Button>
          <Button variant="secondary" onClick={loadObligations}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* INCOMPLETE PROFILE ALERT BANNER */}
      {taxProfile && !isTaxProfileComplete(taxProfile) && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} color="var(--color-danger)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-danger)' }}>
                CONFIGURACIÓN TRIBUTARIA INCOMPLETA
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Faltan datos fiscales requeridos (NIT, Régimen, Municipio, Responsabilidades RUT). Complete la configuración en Ajustes para generar y proyectar obligaciones fiscales automáticamente.
              </div>
            </div>
          </div>
          <a href="/settings" className="btn btn-primary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            Completar Perfil
          </a>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Filtrar por Impuesto:
          </span>
          <select
            className="form-select"
            style={{ width: '180px' }}
            value={taxTypeFilter}
            onChange={(e) => setTaxTypeFilter(e.target.value)}
          >
            <option value="ALL">Todos los Tributos</option>
            <option value="IVA">IVA (Bimestral)</option>
            <option value="RETENCION_FUENTE">Retención en la fuente</option>
            <option value="ICA">ICA Municipal</option>
            <option value="RENTA">Renta Anual</option>
          </select>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          {obligations.length} obligaciones registradas
        </div>
      </div>

      {/* Obligations List / Calendar Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Obligación / Tributo</th>
                <th>Periodo Fiscal</th>
                <th>Fecha Límite</th>
                <th>Días Restantes</th>
                <th>Monto Estimado</th>
                <th>Monto Definitivo</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones de Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Cargando obligaciones tributarias...
                  </td>
                </tr>
              ) : obligations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                    No hay obligaciones registradas para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                obligations.map((ob) => (
                  <tr key={ob.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{ob.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{ob.tax_type}</div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ob.period}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-white)', fontWeight: 500 }}>
                      {ob.due_date}
                    </td>
                    <td>
                      {ob.status === 'PAID' || ob.status === 'FILED' ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>Cumplido</span>
                      ) : (ob.days_remaining ?? 0) < 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600 }}>
                          Vencido ({Math.abs(ob.days_remaining ?? 0)}d)
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: (ob.days_remaining ?? 0) <= 5 ? 'var(--color-warning)' : 'var(--text-dim)' }}>
                          {ob.days_remaining} días
                        </span>
                      )}
                    </td>
                    <td className="num-mono" style={{ fontWeight: 600 }}>
                      ${Number(ob.estimated_amount).toLocaleString('es-CO')}
                    </td>
                    <td className="num-mono" style={{ color: ob.actual_amount ? 'var(--text-white)' : 'var(--text-dim)' }}>
                      {ob.actual_amount ? `$${Number(ob.actual_amount).toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td>{getStatusBadge(ob.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {ob.status !== 'FILED' && ob.status !== 'PAID' && (
                          <button
                            onClick={() => handleOpenStatusModal(ob, 'FILED')}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--paguro-blue)' }}
                            title="Marcar como presentado ante la DIAN"
                          >
                            Presentar
                          </button>
                        )}
                        {ob.status !== 'PAID' && (
                          <button
                            onClick={() => handleOpenStatusModal(ob, 'PAID')}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-success)' }}
                            title="Marcar como pagado con soporte bancario"
                          >
                            Pagar
                          </button>
                        )}
                        {ob.status === 'PAID' && (
                          <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} />
                            Al día
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Programar Obligación Tributaria"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">Nombre de la Obligación</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej: Declaración de IVA Bimestre 1 - 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tributo</label>
              <select
                className="form-select"
                value={form.tax_type}
                onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
              >
                <option value="IVA">IVA</option>
                <option value="RETENCION_FUENTE">Retención en la fuente</option>
                <option value="ICA">ICA</option>
                <option value="RENTA">Renta</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Periodo</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="2026-B1"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Fecha Límite</label>
              <input
                type="date"
                required
                className="form-input"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Monto Estimado (COP)</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-input"
                placeholder="0.00"
                value={form.estimated_amount || ''}
                onChange={(e) => setForm({ ...form, estimated_amount: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notas</label>
            <input
              type="text"
              className="form-input"
              placeholder="Instrucciones o detalles de pago..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Programar Obligación'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* UPDATE STATUS MODAL */}
      {actionTarget && (
        <Modal
          isOpen={!!actionTarget}
          onClose={() => setActionTarget(null)}
          title={`Actualizar Estado • ${actionTarget.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Marcar obligación como <strong style={{ color: 'var(--text-white)' }}>{newStatus}</strong>.
            </div>

            <div className="form-group">
              <label className="form-label">Monto Definitivo Liquidado (COP)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={actualAmount}
                onChange={(e) => setActualAmount(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notas de Presentación / Pago</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Pagado mediante PSE Bancolombia Ref #981248"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setActionTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmStatus}
                style={{
                  backgroundColor:
                    newStatus === 'PAID' ? 'var(--color-success)' : 'var(--paguro-blue)',
                }}
              >
                Confirmar {newStatus === 'PAID' ? 'Pago' : 'Presentación'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
