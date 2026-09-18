'use client';

// ============================================================================
// Paguro Finance - Operational Tax & VAT (IVA) Module
// Multi-company isolated, RLS-enforced, Traceable Line-Item Drill-Down, Zero mock-store
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Percent,
  Lock,
  Unlock,
  AlertCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  Eye,
  CheckCircle2,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  TaxPeriodWithCalculations,
  TaxPeriodStatus,
  TaxAdjustmentType,
} from '@/types/database';
import {
  getTaxPeriodsAction,
  getTaxPeriodByIdAction,
  createTaxPeriodAction,
  updateTaxPeriodStatusAction,
  addTaxAdjustmentAction,
} from '@/lib/actions/taxes';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const CLOSE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

export default function TaxPage() {
  const [periods, setPeriods] = useState<TaxPeriodWithCalculations[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [detailedPeriod, setDetailedPeriod] = useState<TaxPeriodWithCalculations | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Tab for Drill-Down
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'adjustments'>('sales');

  // User authorization
  const [userRole, setUserRole] = useState<string | null>(null);
  const canManage = userRole ? MANAGE_ROLES.includes(userRole) : false;
  const canClose = userRole ? CLOSE_ROLES.includes(userRole) : false;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isConfirmStatusModalOpen, setIsConfirmStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaxPeriodStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form: Create Period
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newPeriodNotes, setNewPeriodNotes] = useState('');

  // Form: Add Adjustment
  const [adjustType, setAdjustType] = useState<TaxAdjustmentType>('INCREASE_DEDUCTIBLE');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // 1. Fetch user role
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

  // 2. Load all periods
  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getTaxPeriodsAction();
      if (res.success && res.data) {
        setPeriods(res.data);
        if (res.data.length > 0) {
          // Keep current selection or default to first
          setSelectedPeriodId((prev) => {
            if (prev && res.data!.some((p) => p.id === prev)) {
              return prev;
            }
            return res.data![0].id;
          });
        } else {
          setSelectedPeriodId(null);
          setDetailedPeriod(null);
        }
      } else {
        setErrorMsg(res.error || 'Error al cargar periodos de impuestos.');
      }
    } catch (err: any) {
      console.error('[TaxPage] Error loading periods:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar periodos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  // 3. Load drill-down details for selected period
  const loadPeriodDetails = useCallback(async (periodId: string) => {
    setDetailLoading(true);
    try {
      const res = await getTaxPeriodByIdAction(periodId);
      if (res.success && res.data) {
        setDetailedPeriod(res.data);
      } else {
        setErrorMsg(res.error || 'No se pudo obtener el detalle del periodo.');
      }
    } catch (err: any) {
      console.error('[TaxPage] Error loading detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadPeriodDetails(selectedPeriodId);
    }
  }, [selectedPeriodId, loadPeriodDetails]);

  // Handler: Create Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await createTaxPeriodAction({
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        notes: newPeriodNotes.trim() || null,
      });

      if (res.success && res.data) {
        setSuccessMsg(res.message || 'Periodo de IVA creado exitosamente.');
        setIsCreateModalOpen(false);
        setNewPeriodStart('');
        setNewPeriodEnd('');
        setNewPeriodNotes('');
        await loadPeriods();
        setSelectedPeriodId(res.data.id);
      } else {
        setErrorMsg(res.error || 'Error al crear el periodo de impuestos.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al crear periodo.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Change Period Status
  const handleConfirmStatusTransition = async () => {
    if (!selectedPeriodId || !pendingStatus) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await updateTaxPeriodStatusAction(selectedPeriodId, pendingStatus);
      if (res.success) {
        setSuccessMsg(res.message || 'Estado del periodo actualizado con éxito.');
        setIsConfirmStatusModalOpen(false);
        setPendingStatus(null);
        await loadPeriods();
        await loadPeriodDetails(selectedPeriodId);
      } else {
        setErrorMsg(res.error || 'Error al actualizar el estado del periodo.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al actualizar estado.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Add Adjustment
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await addTaxAdjustmentAction({
        tax_period_id: selectedPeriodId,
        adjustment_type: adjustType,
        amount: Number(adjustAmount),
        reason: adjustReason.trim(),
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Ajuste de IVA registrado correctamente.');
        setIsAdjustModalOpen(false);
        setAdjustAmount(0);
        setAdjustReason('');
        await loadPeriods();
        await loadPeriodDetails(selectedPeriodId);
      } else {
        setErrorMsg(res.error || 'Error al registrar el ajuste de IVA.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al registrar el ajuste.');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedPeriod = detailedPeriod || periods.find((p) => p.id === selectedPeriodId);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Control Operativo de IVA por Periodo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Consolidación y trazabilidad de IVA generado en ventas, IVA descontable en compras y ajustes contables.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="md" onClick={loadPeriods} icon={<RefreshCw size={15} />}>
            Actualizar
          </Button>

          {canManage && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Nuevo Periodo Fiscal
            </Button>
          )}
        </div>
      </div>

      {/* Compliance Disclaimer Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        <AlertCircle size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Control Operativo:</strong> Los cálculos tributarios reflejados en este módulo son de naturaleza operativa interna con trazabilidad a facturas y compras en Supabase. No constituyen una declaración tributaria oficial ni reemplazan la validación formal del contador o revisor fiscal ante la DIAN.
        </span>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger)',
            color: 'var(--color-danger)',
            fontSize: '13px',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando periodos de IVA...</div>
        </div>
      ) : periods.length === 0 ? (
        /* Empty State */
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-primary)',
            }}
          >
            <Percent size={30} />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>
            No hay periodos de IVA registrados
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', maxWidth: '460px', margin: '0 auto 20px' }}>
            Configure el primer periodo fiscal para consolidar automáticamente el IVA generado en ventas y el IVA descontable de compras.
          </p>
          {canManage && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
              Crear Primer Periodo Fiscal
            </Button>
          )}
        </div>
      ) : selectedPeriod ? (
        <div>
          {/* Period Selector & Control Bar */}
          <div
            className="card"
            style={{
              marginBottom: '20px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)' }}>
                Periodo Seleccionado:
              </div>
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '240px', fontWeight: 600 }}
                value={selectedPeriodId || ''}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.tax_type} ({formatDate(p.period_start)} - {formatDate(p.period_end)}) [{p.status.toUpperCase()}]
                  </option>
                ))}
              </select>

              <Badge status={selectedPeriod.status} />

              {selectedPeriod.closed_at && (
                <div style={{ fontSize: '12px', color: '#f87171' }}>
                  Congelado el {formatDate(selectedPeriod.closed_at)}
                </div>
              )}
            </div>

            {/* Period Status Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedPeriod.status !== 'closed' && canManage && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setIsAdjustModalOpen(true)}
                >
                  Registrar Ajuste
                </Button>
              )}

              {selectedPeriod.status === 'open' && canManage && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPendingStatus('reviewed');
                    setIsConfirmStatusModalOpen(true);
                  }}
                >
                  Marcar en Revisión
                </Button>
              )}

              {selectedPeriod.status === 'reviewed' && canManage && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPendingStatus('open');
                    setIsConfirmStatusModalOpen(true);
                  }}
                >
                  Regresar a Abierto
                </Button>
              )}

              {selectedPeriod.status !== 'closed' && canClose && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Lock size={14} />}
                  onClick={() => {
                    setPendingStatus('closed');
                    setIsConfirmStatusModalOpen(true);
                  }}
                >
                  Cerrar & Congelar Periodo
                </Button>
              )}

              {selectedPeriod.status === 'closed' && canClose && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Unlock size={14} />}
                  onClick={() => {
                    setPendingStatus('reopened');
                    setIsConfirmStatusModalOpen(true);
                  }}
                >
                  Reabrir Periodo
                </Button>
              )}
            </div>
          </div>

          {/* Current Period Summary Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '4px' }}>
                  Liquidación Operativa de IVA ({formatDate(selectedPeriod.period_start)} — {formatDate(selectedPeriod.period_end)})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Datos consolidados de facturas y compras en Supabase | Moneda: COP
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  {selectedPeriod.net_tax >= 0 ? 'IVA Estimado a Pagar' : 'Saldo a Favor Estimado'}
                </div>
                <div
                  className="num-mono"
                  style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    color: selectedPeriod.net_tax >= 0 ? 'var(--color-purple)' : 'var(--color-success)',
                  }}
                >
                  {formatCurrency(Math.abs(selectedPeriod.net_tax))}
                </div>
              </div>
            </div>

            {/* KPI Cards: Mathematical Decomposition */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Card 1: IVA Generado */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    (+) IVA Generado (Ventas)
                  </div>
                  <TrendingUp size={16} color="#34d399" />
                </div>
                <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#34d399' }}>
                  {formatCurrency(selectedPeriod.generated_tax)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Base Gravable: <strong className="num-mono">{formatCurrency(selectedPeriod.sales_taxable_base)}</strong> ({selectedPeriod.sales_count} facturas)
                </div>
              </div>

              {/* Card 2: IVA Descontable */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    (-) IVA Descontable (Compras)
                  </div>
                  <TrendingDown size={16} color="#c084fc" />
                </div>
                <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: '#c084fc' }}>
                  {formatCurrency(selectedPeriod.deductible_tax)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Base Compras: <strong className="num-mono">{formatCurrency(selectedPeriod.purchases_taxable_base)}</strong> ({selectedPeriod.purchases_count} soportes)
                </div>
              </div>

              {/* Card 3: Ajustes Manuales */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    (+/-) Ajustes de Periodo
                  </div>
                  <Scale size={16} color="#fbbf24" />
                </div>
                <div
                  className="num-mono"
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: selectedPeriod.adjustments >= 0 ? '#fbbf24' : '#34d399',
                  }}
                >
                  {selectedPeriod.adjustments > 0 ? '+' : ''}
                  {formatCurrency(selectedPeriod.adjustments)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {selectedPeriod.adjustments_list?.length || 0} ajustes manuales auditados
                </div>
              </div>

              {/* Card 4: Net Tax */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-purple)', textTransform: 'uppercase' }}>
                    (=) Saldo Neto Resultante
                  </div>
                  <Percent size={16} color="var(--color-purple)" />
                </div>
                <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
                  {formatCurrency(selectedPeriod.net_tax)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  {selectedPeriod.net_tax >= 0 ? 'Saldo estimado a favor de la DIAN' : 'Saldo acumulado a favor de la Empresa'}
                </div>
              </div>
            </div>

            {selectedPeriod.notes && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <strong>Observaciones del Periodo:</strong> {selectedPeriod.notes}
              </div>
            )}
          </div>

          {/* Drill-Down Section with Tabs */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveTab('sales')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: activeTab === 'sales' ? 600 : 400,
                    backgroundColor: activeTab === 'sales' ? 'rgba(52, 211, 153, 0.15)' : 'transparent',
                    color: activeTab === 'sales' ? '#34d399' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Ventas / IVA Generado ({selectedPeriod.sales_count})
                </button>

                <button
                  onClick={() => setActiveTab('purchases')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: activeTab === 'purchases' ? 600 : 400,
                    backgroundColor: activeTab === 'purchases' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                    color: activeTab === 'purchases' ? '#c084fc' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Compras / IVA Descontable ({selectedPeriod.purchases_count})
                </button>

                <button
                  onClick={() => setActiveTab('adjustments')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: activeTab === 'adjustments' ? 600 : 400,
                    backgroundColor: activeTab === 'adjustments' ? 'rgba(251, 191, 36, 0.15)' : 'transparent',
                    color: activeTab === 'adjustments' ? '#fbbf24' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Ajustes Manuales ({selectedPeriod.adjustments_list?.length || 0})
                </button>
              </div>

              {detailLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
                  <RefreshCw size={14} className="animate-spin" /> Cargando detalle...
                </div>
              )}
            </div>

            {/* TAB CONTENT: Sales Invoices Drill-Down */}
            {activeTab === 'sales' && (
              <div>
                {!selectedPeriod.sales_items || selectedPeriod.sales_items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                    No hay facturas de venta emitidas en el rango de fechas de este periodo.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Factura</th>
                          <th>Cliente</th>
                          <th>Fecha Emisión</th>
                          <th>Base Gravable (Subtotal)</th>
                          <th>IVA Generado</th>
                          <th>Total Factura</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPeriod.sales_items.map((inv) => (
                          <tr key={inv.id}>
                            <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                              {inv.invoice_number}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>{inv.customer_name}</div>
                              {inv.customer_tax_id && (
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{inv.customer_tax_id}</div>
                              )}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {formatDate(inv.issue_date)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px' }}>
                              {formatCurrency(inv.subtotal)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>
                              {formatCurrency(inv.tax_total)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px' }}>
                              {formatCurrency(inv.total)}
                            </td>
                            <td>
                              <Badge status={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Purchase Documents Drill-Down */}
            {activeTab === 'purchases' && (
              <div>
                {!selectedPeriod.purchases_items || selectedPeriod.purchases_items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                    No hay documentos de compra o gastos aprobados en el rango de fechas de este periodo.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Documento / Soporte</th>
                          <th>Proveedor</th>
                          <th>Categoría</th>
                          <th>Fecha Documento</th>
                          <th>Base Compras (Subtotal)</th>
                          <th>IVA Descontable</th>
                          <th>Total Documento</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPeriod.purchases_items.map((pur) => (
                          <tr key={pur.id}>
                            <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                              {pur.document_number}
                            </td>
                            <td>
                              <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>{pur.supplier_name}</div>
                              {pur.supplier_tax_id && (
                                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{pur.supplier_tax_id}</div>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                {pur.category}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {formatDate(pur.document_date)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px' }}>
                              {formatCurrency(pur.subtotal)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600, color: '#c084fc' }}>
                              {formatCurrency(pur.deductible_tax_total)}
                            </td>
                            <td className="num-mono" style={{ fontSize: '13px' }}>
                              {formatCurrency(pur.total)}
                            </td>
                            <td>
                              <Badge status={pur.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Adjustments Drill-Down */}
            {activeTab === 'adjustments' && (
              <div>
                {!selectedPeriod.adjustments_list || selectedPeriod.adjustments_list.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                    No se han registrado ajustes manuales para este periodo.
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha Registro</th>
                          <th>Tipo de Ajuste</th>
                          <th>Motivo / Justificación</th>
                          <th>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPeriod.adjustments_list.map((adj) => {
                          const isDebit =
                            adj.adjustment_type === 'INCREASE_GENERATED' ||
                            adj.adjustment_type === 'DECREASE_DEDUCTIBLE';

                          return (
                            <tr key={adj.id}>
                              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {formatDate(adj.created_at)}
                              </td>
                              <td style={{ fontSize: '12px', fontWeight: 500 }}>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: isDebit ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                    color: isDebit ? 'var(--color-danger)' : 'var(--color-success)',
                                    fontSize: '11px',
                                  }}
                                >
                                  {adj.adjustment_type}
                                </span>
                              </td>
                              <td style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                                {adj.reason}
                              </td>
                              <td
                                className="num-mono"
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: isDebit ? 'var(--color-danger)' : 'var(--color-success)',
                                }}
                              >
                                {isDebit ? '+' : '-'}
                                {formatCurrency(adj.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Historical Tax Periods Table */}
      {periods.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '16px' }}>
            Historial de Periodos de IVA Configurados
          </h2>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Impuesto</th>
                  <th>Inicio Periodo</th>
                  <th>Fin Periodo</th>
                  <th>IVA Generado</th>
                  <th>IVA Descontable</th>
                  <th>Ajustes</th>
                  <th>Saldo Estimado</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.tax_type}</td>
                    <td style={{ fontSize: '12px' }}>{formatDate(p.period_start)}</td>
                    <td style={{ fontSize: '12px' }}>{formatDate(p.period_end)}</td>
                    <td className="num-mono" style={{ fontSize: '13px' }}>
                      {formatCurrency(p.generated_tax)}
                    </td>
                    <td className="num-mono" style={{ fontSize: '13px' }}>
                      {formatCurrency(p.deductible_tax)}
                    </td>
                    <td className="num-mono" style={{ fontSize: '13px' }}>
                      {formatCurrency(p.adjustments)}
                    </td>
                    <td
                      className="num-mono"
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: p.net_tax >= 0 ? 'var(--color-purple)' : 'var(--color-success)',
                      }}
                    >
                      {formatCurrency(p.net_tax)}
                    </td>
                    <td>
                      <Badge status={p.status} />
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedPeriodId(p.id)}
                      >
                        Ver Detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Tax Period */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Crear Periodo Fiscal de IVA"
        >
          <form onSubmit={handleCreatePeriod}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Defina el rango de fechas para el periodo de cálculo de IVA. El sistema consolidará automáticamente las facturas de venta y compras emitidas dentro de este intervalo.
              </p>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={newPeriodStart}
                  onChange={(e) => setNewPeriodStart(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Fecha de Fin *
                </label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Observaciones / Notas (Opcional)
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Ej: Bimestre 1 (Ene-Feb 2026), IVA General..."
                  value={newPeriodNotes}
                  onChange={(e) => setNewPeriodNotes(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={actionLoading || !newPeriodStart || !newPeriodEnd}
              >
                {actionLoading ? 'Guardando...' : 'Crear Periodo'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Add Manual Adjustment */}
      {isAdjustModalOpen && (
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          title="Registrar Ajuste Manual de IVA"
        >
          <form onSubmit={handleAddAdjustment}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                Periodo: <strong>{selectedPeriod ? `${formatDate(selectedPeriod.period_start)} al ${formatDate(selectedPeriod.period_end)}` : ''}</strong>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Tipo de Ajuste *
                </label>
                <select
                  className="form-input"
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as TaxAdjustmentType)}
                  required
                >
                  <option value="INCREASE_DEDUCTIBLE">Aumentar IVA Descontable (Crédito / Mayor Deducción)</option>
                  <option value="DECREASE_DEDUCTIBLE">Disminuir IVA Descontable (Rechazo de Compra / Menor Deducción)</option>
                  <option value="INCREASE_GENERATED">Aumentar IVA Generado (Omisión de Venta / Mayor Impuesto)</option>
                  <option value="DECREASE_GENERATED">Disminuir IVA Generado (Devolución en Ventas / Menor Impuesto)</option>
                  <option value="OTHER_CREDIT">Otro Saldo a Favor / Crédito Fiscal Especial</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Monto del Ajuste (COP) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input num-mono"
                  required
                  value={adjustAmount || ''}
                  onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Motivo y Justificación Contable (Obligatorio) *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  placeholder="Explique el sustento contable, legal o nota técnica para este ajuste..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsAdjustModalOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={actionLoading || adjustAmount <= 0 || !adjustReason.trim()}
              >
                {actionLoading ? 'Registrando...' : 'Aplicar Ajuste'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Confirm Status Transition */}
      {isConfirmStatusModalOpen && (
        <Modal
          isOpen={isConfirmStatusModalOpen}
          onClose={() => setIsConfirmStatusModalOpen(false)}
          title="Confirmar Cambio de Estado del Periodo"
        >
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              ¿Está seguro de que desea cambiar el estado del periodo fiscal a{' '}
              <strong style={{ color: 'var(--text-white)' }}>{pendingStatus?.toUpperCase()}</strong>?
            </p>

            {pendingStatus === 'closed' && (
              <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '16px' }}>
                Al cerrar el periodo, quedará congelado y la base de datos rechazará automáticamente la emisión o modificación de facturas de venta y compras cuyas fechas caigan dentro de este intervalo.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                variant="secondary"
                onClick={() => setIsConfirmStatusModalOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmStatusTransition}
                disabled={actionLoading}
              >
                {actionLoading ? 'Actualizando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
