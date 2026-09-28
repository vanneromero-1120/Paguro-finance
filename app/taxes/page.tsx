'use client';

// ============================================================================
// Paguro Finance V1 - Colombian Tax Operations Dashboard
// Estimated IVA, Retención en la fuente, ICA, Audit Flags & DIAN Disclaimers
// ============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Percent,
  Layers,
  Calendar,
  AlertTriangle,
  FileCheck2,
  Building,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  calculateTaxPositionAction,
  getTaxObligationsAction,
  getCompanyTaxProfileAction,
  TaxPositionSummary,
} from '@/lib/actions/tax-operations';
import { TaxObligation, CompanyTaxProfile } from '@/types/v1-financial';

export default function TaxesPage() {
  const [taxPosition, setTaxPosition] = useState<TaxPositionSummary | null>(null);
  const [obligations, setObligations] = useState<TaxObligation[]>([]);
  const [taxProfile, setTaxProfile] = useState<CompanyTaxProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTaxData = async () => {
    setLoading(true);
    const [posRes, obRes, profRes] = await Promise.all([
      calculateTaxPositionAction(),
      getTaxObligationsAction(),
      getCompanyTaxProfileAction(),
    ]);

    if (posRes.success && posRes.data) setTaxPosition(posRes.data);
    if (obRes.success && obRes.data) setObligations(obRes.data);
    if (profRes.success && profRes.data) setTaxProfile(profRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadTaxData();
  }, []);

  const overdueObs = obligations.filter((o) => o.status === 'OVERDUE');
  const upcomingObs = obligations.filter((o) => o.status === 'UPCOMING' || o.status === 'DUE_SOON');

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Operaciones Tributarias Colombia</h1>
            <span className="badge badge-brand-blue" style={{ fontSize: '10px' }}>
              DIAN & ICA
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Monitoreo y estimación de pasivos fiscales: IVA, Retefuente, ICA y Provisión de Renta
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/obligations" className="btn btn-secondary" style={{ fontSize: '13px' }}>
            <Calendar size={14} />
            <span>Calendario de Obligaciones</span>
          </Link>
          <Button variant="secondary" onClick={loadTaxData}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* DIAN DISCLAIMER BANNER */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: 'rgba(0, 152, 255, 0.06)',
          border: '1px solid rgba(0, 152, 255, 0.25)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} color="var(--paguro-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-white)' }}>
            Herramienta de Control Gerencial & Inteligencia Fiscal:
          </span>{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            Este módulo calcula estimaciones a partir de los movimientos bancarios y documentos contabilizados. No
            reemplaza el dictamen ni la liquidación definitiva del Contador Público o Revisor Fiscal ni sustituye los
            servicios informáticos de la DIAN.
          </span>
        </div>
      </div>

      {/* INCOMPLETE PROFILE ALERT BANNER */}
      {taxPosition && !taxPosition.is_profile_complete && (
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
                Faltan datos fiscales oficiales (NIT, Régimen, Municipio, Responsabilidades RUT). No se fabrican obligaciones ficticias hasta completar el perfil.
              </div>
            </div>
          </div>
          <Link href="/settings" className="btn btn-primary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            Completar Perfil
          </Link>
        </div>
      )}

      {/* IMPORT TAX SAFETY BANNER */}
      {taxPosition && taxPosition.unverified_import_count > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <AlertTriangle size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-warning)' }}>
              Seguridad Fiscal en Operaciones de Importación:
            </span>{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              Se detectaron {taxPosition.unverified_import_count} movimiento(s) de importación (Facturas comerciales internacionales). La factura comercial extranjera no acredita por sí sola IVA descontable en Colombia. El IVA correspondiente se mantiene en estado <strong>REQUIERE REVISIÓN</strong> y no se deducirá hasta adjuntar la Declaración de Importación oficial DIAN (Formulario 500).
            </span>
          </div>
        </div>
      )}

      {/* KPI GRID */}
      <div className="kpi-grid">
        {/* IVA Generado */}
        <StatCard
          label="IVA Generado"
          value={taxPosition ? `$${taxPosition.generated_iva.toLocaleString('es-CO')}` : '—'}
          subtitle={`Cobrado en ventas gravadas (${taxPosition?.value_statuses?.generated_iva || 'ESTIMADO'})`}
          highlightColor="primary"
          icon={<TrendingUp size={18} />}
        />

        {/* IVA Descontable */}
        <StatCard
          label="IVA Descontable"
          value={taxPosition ? `$${taxPosition.deductible_iva.toLocaleString('es-CO')}` : '—'}
          subtitle={`Pagado en compras válidas (${taxPosition?.value_statuses?.deductible_iva || 'ESTIMADO'})`}
          highlightColor={taxPosition?.value_statuses?.deductible_iva === 'REVIEW_REQUIRED' ? 'warning' : 'success'}
          icon={<TrendingDown size={18} />}
        />

        {/* Posición Neta IVA */}
        <StatCard
          label="IVA Neto Estimado"
          value={taxPosition ? `$${taxPosition.estimated_net_iva.toLocaleString('es-CO')}` : '—'}
          subtitle={
            taxPosition?.iva_position_type === 'PAYABLE'
              ? `Saldo a pagar (${taxPosition.value_statuses?.net_iva || 'ESTIMADO'})`
              : `Saldo a favor (${taxPosition?.value_statuses?.net_iva || 'ESTIMADO'})`
          }
          highlightColor={taxPosition?.iva_position_type === 'PAYABLE' ? 'danger' : 'success'}
          icon={<Layers size={18} />}
        />

        {/* Retención en la fuente */}
        <StatCard
          label="Retención Estimada"
          value={taxPosition ? `$${taxPosition.withholding_tax_estimated.toLocaleString('es-CO')}` : '—'}
          subtitle={`Retefuente compras (${taxPosition?.value_statuses?.withholding || 'ESTIMADO'})`}
          highlightColor="warning"
          icon={<Percent size={18} />}
        />
      </div>

      {/* TAX PROFILE & OBLIGATIONS OVERVIEW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        {/* COMPANY TAX PROFILE CARD */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Perfil Tributario Empresarial</h2>
            <Link href="/settings" style={{ fontSize: '12px', color: 'var(--paguro-blue)' }}>
              Editar Perfil
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Régimen Tributario:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                {taxProfile?.tax_regime || 'RESPONSABLE_DE_IVA'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Municipio ICA:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                {taxProfile?.municipality || 'Medellín'} (Tarifa:{' '}
                {((taxProfile?.ica_configuration?.rate || 0.007) * 1000).toFixed(1)} x 1.000)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Responsable de IVA:</span>
              <span style={{ fontWeight: 600, color: taxProfile?.iva_responsible ? 'var(--color-success)' : 'var(--text-muted)' }}>
                {taxProfile?.iva_responsible ? 'SÍ (Bimestral / Cuatrimestral)' : 'NO'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Agente de Retención:</span>
              <span style={{ fontWeight: 600, color: taxProfile?.withholding_agent ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                {taxProfile?.withholding_agent ? 'SÍ' : 'NO'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                Responsabilidades RUT:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(taxProfile?.rut_responsibilities || []).map((r, idx) => (
                  <span key={idx} className="badge badge-neutral" style={{ fontSize: '10px' }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* UPCOMING & OVERDUE OBLIGATIONS */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Obligaciones en Calendario</h2>
            <Link href="/obligations" style={{ fontSize: '12px', color: 'var(--paguro-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Ver todas</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {overdueObs.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--color-danger)',
                fontSize: '12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={15} />
              <span>{overdueObs.length} obligación(es) vencida(s) pendiente(s) de presentación o pago.</span>
            </div>
          )}

          {obligations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {obligations.slice(0, 4).map((ob) => (
                <div
                  key={ob.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
                      {ob.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Vence: {ob.due_date} • {ob.period}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                      ${Number(ob.estimated_amount).toLocaleString('es-CO')}
                    </div>
                    <span
                      className={`badge ${
                        ob.status === 'OVERDUE'
                          ? 'badge-danger'
                          : ob.status === 'PAID'
                          ? 'badge-success'
                          : 'badge-warning'
                      }`}
                      style={{ fontSize: '9px', padding: '1px 5px' }}
                    >
                      {ob.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              No se han programado obligaciones tributarias en el calendario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
