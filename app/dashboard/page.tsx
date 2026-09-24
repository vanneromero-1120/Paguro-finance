'use client';

// ============================================================================
// Paguro Finance V1 - Executive Financial Intelligence Dashboard
// 9 Real-Time KPI Cards, 6 Business Sections, Strict Paguro Brand Palette
// ============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Landmark,
  FileCheck2,
  CalendarClock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getV1DashboardDataAction,
  V1DashboardData,
  V1DashboardFilter,
} from '@/lib/actions/dashboard';

export default function V1DashboardPage() {
  const [filter, setFilter] = useState<V1DashboardFilter>('MONTH');
  const [data, setData] = useState<V1DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (f: V1DashboardFilter) => {
    setLoading(true);
    const res = await getV1DashboardDataAction(f);
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData(filter);
  }, [filter]);

  const kpis = data?.kpis;
  const currency = data?.company?.currency || 'COP';

  const formatMoney = (amount: number) => {
    return `$${Math.abs(amount).toLocaleString('es-CO')} ${currency}`;
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header & Period Filter */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Panel de Inteligencia Financiera</h1>
            <span className="badge badge-brand-blue" style={{ fontSize: '10px' }}>
              V1 LIVE
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            {data?.company?.legalName} • NIT {data?.company?.taxId} • Corte: {data?.dateFrom} a {data?.dateTo}
          </p>
        </div>

        {/* Filter Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: '10px',
            padding: '4px',
            gap: '4px',
          }}
        >
          {(
            [
              { key: '7D', label: '7 Días' },
              { key: '30D', label: '30 Días' },
              { key: 'MONTH', label: 'Este Mes' },
              { key: 'QUARTER', label: 'Este Trimestre' },
              { key: 'YEAR', label: 'Este Año' },
            ] as { key: V1DashboardFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: filter === item.key ? 'var(--paguro-blue)' : 'transparent',
                color: filter === item.key ? '#ffffff' : 'var(--text-muted)',
                fontWeight: filter === item.key ? 600 : 400,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() => loadData(filter)}
            title="Refrescar datos"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-dim)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 9 V1 KPI CARDS GRID */}
      <div className="kpi-grid">
        {/* 1. Cash Position */}
        <StatCard
          label="Posición Neta"
          value={kpis ? formatMoney(kpis.netCashFlow) : '—'}
          subtitle="Flujo libre en periodo"
          highlightColor={kpis && kpis.netCashFlow >= 0 ? 'success' : 'danger'}
          icon={<DollarSign size={18} />}
          trend={kpis && kpis.netCashFlow >= 0 ? 'up' : 'down'}
        />

        {/* 2. Total Income */}
        <StatCard
          label="Ingresos Totales"
          value={kpis ? formatMoney(kpis.totalIncome) : '—'}
          subtitle="Cobros y ventas validadas"
          highlightColor="success"
          icon={<TrendingUp size={18} />}
        />

        {/* 3. Total Expenses */}
        <StatCard
          label="Egresos Totales"
          value={kpis ? formatMoney(kpis.totalExpenses) : '—'}
          subtitle="Gastos y pagos devengados"
          highlightColor="danger"
          icon={<TrendingDown size={18} />}
        />

        {/* 4. Top Category */}
        <StatCard
          label="Mayor Categoría"
          value={kpis?.topExpenseCategory ? kpis.topExpenseCategory.name : '—'}
          subtitle={
            kpis?.topExpenseCategory
              ? `${formatMoney(kpis.topExpenseCategory.amount)} (${kpis.topExpenseCategory.percentage}%)`
              : 'Sin egresos'
          }
          highlightColor="pink"
          icon={<PieChart size={18} />}
        />

        {/* 5. Unmatched Bank Movements */}
        <StatCard
          label="Sin Conciliar"
          value={kpis ? `${kpis.unmatchedBankMovementsCount} movs` : '—'}
          subtitle={kpis ? `${formatMoney(kpis.unmatchedBankAmount)} en banco` : '—'}
          highlightColor={kpis && kpis.unmatchedBankMovementsCount > 0 ? 'warning' : 'success'}
          icon={<Landmark size={18} />}
        />

        {/* 6. Pending Documents */}
        <StatCard
          label="Docs Pendientes"
          value={kpis ? `${kpis.pendingDocumentsCount} archivos` : '—'}
          subtitle="En cola de revisión humana"
          highlightColor={kpis && kpis.pendingDocumentsCount > 0 ? 'warning' : 'success'}
          icon={<FileCheck2 size={18} />}
        />

        {/* 7. Estimated IVA */}
        <StatCard
          label="IVA Estimado"
          value={kpis ? formatMoney(kpis.estimatedNetIva) : '—'}
          subtitle={kpis?.ivaPositionType === 'PAYABLE' ? 'Saldo a pagar estimado' : 'Saldo a favor'}
          highlightColor="primary"
          icon={<Layers size={18} />}
        />

        {/* 8. Next Tax Obligation */}
        <StatCard
          label="Próximo Impuesto"
          value={kpis?.nextTaxObligation ? kpis.nextTaxObligation.name : 'Al día'}
          subtitle={
            kpis?.nextTaxObligation
              ? `Vence: ${kpis.nextTaxObligation.dueDate} (${kpis.nextTaxObligation.daysRemaining} días)`
              : 'Sin vencimientos inmediatos'
          }
          highlightColor={
            kpis?.nextTaxObligation && kpis.nextTaxObligation.daysRemaining <= 5
              ? 'danger'
              : 'warning'
          }
          icon={<CalendarClock size={18} />}
        />

        {/* 9. AI Advisor CTA */}
        <div
          className="card card-glow-blue"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(19, 27, 46, 0.95) 0%, rgba(12, 18, 34, 0.95) 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} color="var(--paguro-blue)" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--paguro-blue)', textTransform: 'uppercase' }}>
                Asesor IA Paguro
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
              ¿Dudas sobre el flujo o impuestos del periodo?
            </div>
          </div>
          <Link
            href="/ai-advisor"
            className="btn btn-primary"
            style={{ fontSize: '12px', padding: '7px 12px', marginTop: '12px', justifyContent: 'space-between' }}
          >
            <span>Consultar Asesor</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* 6 BUSINESS SECTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        {/* SECTION 1 & 2: CASH OVERVIEW & EXPENSE ANALYSIS */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Análisis de Egresos por Categoría</h2>
            <Link href="/movements" style={{ fontSize: '12px', color: 'var(--paguro-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Ver todos</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {data?.expenseCategories && data.expenseCategories.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.expenseCategories.slice(0, 5).map((cat, idx) => (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-white)' }}>{cat.name}</span>
                    <span className="num-mono" style={{ color: 'var(--text-muted)' }}>
                      {formatMoney(cat.total)} ({cat.percentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${cat.percentage}%`,
                        backgroundColor:
                          idx === 0
                            ? 'var(--paguro-pink)'
                            : idx === 1
                            ? 'var(--paguro-blue)'
                            : 'rgba(255, 255, 255, 0.4)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              No se registran gastos para este corte seleccionado.
            </div>
          )}
        </div>

        {/* SECTION 3: BANKING RECONCILIATION */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Conciliación Bancaria</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Transacciones de banco sin emparejar</p>
            </div>
            <Link href="/movements" style={{ fontSize: '12px', color: 'var(--paguro-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Ir al Ledger</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {data?.unmatchedBankTransactions && data.unmatchedBankTransactions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.unmatchedBankTransactions.slice(0, 4).map((tx) => (
                <div
                  key={tx.id}
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
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-white)' }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {new Date(tx.posted_at).toLocaleDateString('es-CO')} • {tx.bank_account?.institution || 'Banco'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      className="num-mono"
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: tx.direction === 'INFLOW' ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {tx.direction === 'INFLOW' ? '+' : '-'} {formatMoney(tx.amount)}
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }}>
                      Sin Conciliar
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-success)', fontSize: '13px' }}>
              ✓ Todas las transacciones bancarias están conciliadas o no hay registros pendientes.
            </div>
          )}
        </div>

        {/* SECTION 4: TAX POSITION & UPCOMING OBLIGATIONS */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Posición Tributaria Estimada</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>DIAN & Calendario Fiscal Colombia</p>
            </div>
            <Link href="/obligations" style={{ fontSize: '12px', color: 'var(--paguro-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Ver Calendario</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {data?.upcomingTaxObligations && data.upcomingTaxObligations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.upcomingTaxObligations.slice(0, 3).map((ob) => (
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
                      Periodo: {ob.period} • Límite: {ob.due_date}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                      {formatMoney(Number(ob.estimated_amount))}
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }}>
                      {ob.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              No hay obligaciones fiscales pendientes con fecha inmediata.
            </div>
          )}

          <div
            style={{
              marginTop: '16px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 152, 255, 0.06)',
              border: '1px solid rgba(0, 152, 255, 0.15)',
              fontSize: '11px',
              color: 'var(--text-dim)',
            }}
          >
            Nota: Estimación de control interno para la gerencia. No reemplaza las declaraciones oficiales DIAN.
          </div>
        </div>

        {/* SECTION 5: DOCUMENT HEALTH */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Salud Documental & Ingesta Drive</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Facturas electrónicas y soportes</p>
            </div>
            <Link href="/documents" style={{ fontSize: '12px', color: 'var(--paguro-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Ver Documentos</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Descubiertos</div>
              <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)', marginTop: '4px' }}>
                {data?.documentsHealth.discovered || 0}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--color-warning)', textTransform: 'uppercase' }}>Requieren Revisión</div>
              <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-warning)', marginTop: '4px' }}>
                {data?.documentsHealth.requiresReview || 0}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Extraídos por IA</div>
              <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)', marginTop: '4px' }}>
                {data?.documentsHealth.extracted || 0}
              </div>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--color-success)', textTransform: 'uppercase' }}>Vinculados</div>
              <div className="num-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)', marginTop: '4px' }}>
                {data?.documentsHealth.matched || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: RECENT MOVEMENTS TABLE */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Actividad Financiera Reciente</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Últimos movimientos normalizados</p>
          </div>
          <Link href="/movements" className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
            Ver todos los movimientos
          </Link>
        </div>

        {data?.recentMovements && data.recentMovements.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Contraparte</th>
                  <th>Categoría</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.recentMovements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.movement_date}</td>
                    <td style={{ fontWeight: 500 }}>{m.description}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{m.counterparty || '—'}</td>
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
                          m.review_status === 'CONFIRMED'
                            ? 'badge-success'
                            : m.review_status === 'REQUIRES_REVIEW'
                            ? 'badge-warning'
                            : 'badge-neutral'
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
                        fontWeight: 600,
                        color: m.direction === 'INCOME' ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {m.direction === 'INCOME' ? '+' : '-'} {formatMoney(m.amount_cop)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
            No hay movimientos registrados recientemente.
          </div>
        )}
      </div>
    </div>
  );
}
