'use client';

import React, { useState } from 'react';
import { Percent, Lock, Unlock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { INITIAL_TAX_PERIODS, INITIAL_INVOICES, INITIAL_PURCHASES } from '@/lib/supabase/mock-store';
import { TaxPeriod, TaxPeriodStatus } from '@/types/database';
import { calculateNetVat } from '@/lib/finance/taxes';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function TaxPage() {
  const [periods, setPeriods] = useState<TaxPeriod[]>(INITIAL_TAX_PERIODS);
  const [selectedPeriod, setSelectedPeriod] = useState<TaxPeriod>(periods[0]);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Adjustment form
  const [adjustType, setAdjustType] = useState('INCREASE_DEDUCTIBLE');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Calculate live figures for selected period
  const generatedVat = INITIAL_INVOICES
    .filter((inv) => inv.status !== 'void')
    .reduce((acc, inv) => acc + inv.tax_total, 0);

  const deductibleVat = INITIAL_PURCHASES
    .filter((p) => p.status !== 'void')
    .reduce((acc, p) => acc + p.deductible_tax_total, 0);

  const netVat = calculateNetVat(generatedVat, deductibleVat, selectedPeriod.adjustments);

  const handleToggleClosePeriod = () => {
    const newStatus: TaxPeriodStatus = selectedPeriod.status === 'closed' ? 'reopened' : 'closed';
    const updated = {
      ...selectedPeriod,
      status: newStatus,
      closed_at: newStatus === 'closed' ? new Date().toISOString() : null,
    };
    setSelectedPeriod(updated);
    setPeriods(periods.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustAmount === 0 || !adjustReason) return;

    const delta = adjustType.startsWith('INCREASE_GENERATED')
      ? adjustAmount
      : adjustType.startsWith('DECREASE_GENERATED')
      ? -adjustAmount
      : adjustType.startsWith('INCREASE_DEDUCTIBLE')
      ? -adjustAmount
      : adjustAmount;

    const updated = {
      ...selectedPeriod,
      adjustments: selectedPeriod.adjustments + delta,
      net_tax: calculateNetVat(generatedVat, deductibleVat, selectedPeriod.adjustments + delta),
    };

    setSelectedPeriod(updated);
    setPeriods(periods.map((p) => (p.id === updated.id ? updated : p)));
    setIsAdjustModalOpen(false);
    setAdjustAmount(0);
    setAdjustReason('');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Control Operativo de IVA por Periodo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Consolidación de IVA generado en ventas, IVA descontable en compras y ajustes de periodo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedPeriod.status !== 'closed' && (
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              onClick={() => setIsAdjustModalOpen(true)}
            >
              Registrar Ajuste
            </Button>
          )}

          <Button
            variant={selectedPeriod.status === 'closed' ? 'secondary' : 'primary'}
            icon={selectedPeriod.status === 'closed' ? <Unlock size={16} /> : <Lock size={16} />}
            onClick={handleToggleClosePeriod}
          >
            {selectedPeriod.status === 'closed' ? 'Reabrir Periodo' : 'Cerrar & Congelar Periodo'}
          </Button>
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
          marginBottom: '24px',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        <AlertCircle size={18} color="var(--color-primary)" />
        <span>
          <strong>Regla de Cumplimiento:</strong> Los cálculos tributarios reflejados en este módulo son de naturaleza operativa y preliminar para la toma de decisiones internas. No constituyen una declaración tributaria oficial ni reemplazan la validación formal del contador o revisor fiscal ante la DIAN.
        </span>
      </div>

      {/* Current Period Summary Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)' }}>
                Periodo Bimestral ({formatDate(selectedPeriod.period_start)} - {formatDate(selectedPeriod.period_end)})
              </h2>
              <Badge status={selectedPeriod.status} />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Empresa Activa: Paguro Corp S.A.S. | Impuesto: IVA General
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              IVA Estimado a Pagar
            </div>
            <div className="num-mono" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-purple)' }}>
              {formatCurrency(netVat)}
            </div>
          </div>
        </div>

        {/* Detailed Mathematical Decomposition */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              (+) IVA Generado (Ventas)
            </div>
            <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#34d399' }}>
              {formatCurrency(generatedVat)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Proveniente de facturas emitidas válidas
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              (-) IVA Descontable (Compras)
            </div>
            <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: '#c084fc' }}>
              {formatCurrency(deductibleVat)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Proveniente de soportes de gastos
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              (+/-) Ajustes Autorizados
            </div>
            <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: selectedPeriod.adjustments >= 0 ? '#fbbf24' : '#34d399' }}>
              {formatCurrency(selectedPeriod.adjustments)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ajustes manuales con trazabilidad
            </div>
          </div>

          <div style={{ padding: '16px', backgroundColor: 'rgba(139, 92, 246, 0.06)', border: '1px solid var(--color-purple-border)', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-purple)', textTransform: 'uppercase', marginBottom: '6px' }}>
              (=) Saldo Neto Estimado
            </div>
            <div className="num-mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)' }}>
              {formatCurrency(netVat)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {netVat >= 0 ? 'Saldo a favor de la DIAN' : 'Saldo a favor de la Empresa'}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Tax Periods Table */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '16px' }}>
          Historial de Periodos de IVA
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
                <th>Neto a Pagar</th>
                <th>Estado</th>
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
                  <td className="num-mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-purple)' }}>
                    {formatCurrency(p.net_tax)}
                  </td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Tax Adjustment */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Registrar Ajuste Manual de IVA"
      >
        <form onSubmit={handleAddAdjustment}>
          <div className="form-group">
            <label className="form-label">Tipo de Ajuste *</label>
            <select
              className="form-select"
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value)}
            >
              <option value="INCREASE_DEDUCTIBLE">Aumentar IVA Descontable (Crédito Fiscal)</option>
              <option value="DECREASE_DEDUCTIBLE">Disminuir IVA Descontable (Rechazo de Compra)</option>
              <option value="INCREASE_GENERATED">Aumentar IVA Generado (Omisión de Venta)</option>
              <option value="DECREASE_GENERATED">Disminuir IVA Generado (Devolución)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Monto del Ajuste (COP) *</label>
            <input
              type="number"
              min="1"
              required
              className="form-input num-mono"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo Obligatorio (Justificación Auditada) *</label>
            <textarea
              required
              rows={3}
              className="form-textarea"
              placeholder="Explique el sustento contable o legal para este ajuste..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsAdjustModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Aplicar Ajuste
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
