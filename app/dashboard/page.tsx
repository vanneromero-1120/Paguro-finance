// ============================================================================
// Paguro Finance - Authoritative Financial Dashboard
// Real Supabase Data, Server-Side Aggregations, RLS-Enforced, Zero mock-store
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  ShoppingBag,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Percent,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { DashboardData, DashboardPeriod } from '@/types/database';
import { getDashboardDataAction } from '@/lib/actions/dashboard';

export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('month');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const loadData = useCallback(async (period: DashboardPeriod, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await getDashboardDataAction(period);
      if (res.success && res.data) {
        setDashboardData(res.data);
      } else {
        setError(res.error || 'Error al sincronizar datos del panel financiero.');
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado de comunicación con el servidor.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedPeriod);
  }, [selectedPeriod, loadData]);

  const kpis = dashboardData?.kpis;

  return (
    <div>
      {/* Top Welcome & Period Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
              Panel de Control Financiero
            </h1>
            {dashboardData?.company && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--color-primary)',
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
              >
                <Building2 size={12} />
                {dashboardData.company.trade_name}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Métricas consolidadas en tiempo real: facturación, compras, IVA, inventario y flujo de fondos.
            {dashboardData && (
              <span style={{ marginLeft: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
                ({dashboardData.date_from} al {dashboardData.date_to})
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Refresh Action */}
          <button
            onClick={() => loadData(selectedPeriod, true)}
            disabled={loading || refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: refreshing ? 'wait' : 'pointer',
              transition: 'var(--transition-smooth)',
            }}
            title="Recargar datos del panel"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Actualizando...' : 'Recargar'}</span>
          </button>

          {/* Period Selector Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: '8px',
              padding: '4px',
            }}
          >
            {(['month', 'quarter', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: selectedPeriod === period ? 600 : 400,
                  backgroundColor:
                    selectedPeriod === period ? 'var(--color-primary)' : 'transparent',
                  color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                }}
              >
                {period === 'month'
                  ? 'Este Mes'
                  : period === 'quarter'
                  ? 'Este Trimestre'
                  : 'Año en Curso'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            color: 'var(--color-danger)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '13px' }}>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(selectedPeriod)}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Operational Alert Banners (Inventory Low Stock) */}
      {!loading && kpis && kpis.lowStockCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            color: '#fbbf24',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              Alerta de inventario: Hay{' '}
              <strong>{kpis.lowStockCount} producto(s)</strong> en o por debajo del stock mínimo de seguridad.
            </span>
          </div>
          <Link
            href="/inventory/products"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              textDecoration: 'underline',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#fbbf24',
            }}
          >
            Ver catálogo <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !dashboardData && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Consolidando métricas financieras autorizadas...
          </p>
        </div>
      )}

      {/* Core KPI Grid */}
      {dashboardData && kpis && (
        <>
          <div className="kpi-grid">
            <StatCard
              title="Ventas Netas"
              value={formatCurrency(kpis.netSales)}
              subtitle={`${kpis.salesCount} factura(s) válida(s) en el período`}
              icon={<Receipt size={18} />}
              highlightColor="primary"
            />

            <StatCard
              title="Gastos & Compras"
              value={formatCurrency(kpis.totalExpenses)}
              subtitle={`${kpis.expensesCount} soporte(s) y compra(s) registradas`}
              icon={<ShoppingBag size={18} />}
              highlightColor="danger"
            />

            <StatCard
              title="Margen Operativo"
              value={formatCurrency(kpis.operatingMargin)}
              subtitle={`${kpis.operatingMarginPercent.toFixed(1)}% margen bruto operativo`}
              icon={<TrendingUp size={18} />}
              highlightColor={kpis.operatingMargin >= 0 ? 'success' : 'danger'}
            />

            <StatCard
              title="Cuentas por Cobrar (CxC)"
              value={formatCurrency(kpis.accountsReceivable)}
              subtitle={`${kpis.openInvoicesCount} factura(s) con saldo abierto`}
              icon={<CreditCard size={18} />}
              highlightColor="warning"
            />

            <StatCard
              title="Cuentas por Pagar (CxP)"
              value={formatCurrency(kpis.accountsPayable)}
              subtitle={`${kpis.openPurchasesCount} obligación(es) a proveedores`}
              icon={<DollarSign size={18} />}
              highlightColor="danger"
            />

            <StatCard
              title="IVA Estimado a Pagar"
              value={formatCurrency(kpis.estimatedVatPayable)}
              subtitle={`Gen: ${formatCurrency(kpis.generatedVat)} | Desc: ${formatCurrency(kpis.deductibleVat)}`}
              icon={<Percent size={18} />}
              highlightColor="purple"
            />

            <StatCard
              title="Valoración de Inventario"
              value={formatCurrency(kpis.inventoryValuation)}
              subtitle={`${kpis.trackedProductsCount} referencias registradas`}
              icon={<Package size={18} />}
              highlightColor="primary"
            />
          </div>

          {/* Two Column Layout: Recent Sales & Recent Expenses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            {/* Recent Invoices Card */}
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                    Facturas de Venta Recientes
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Últimos documentos emitidos a clientes
                  </span>
                </div>
                <Link
                  href="/sales/invoices"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  Ver todas
                </Link>
              </div>

              <div className="table-container">
                {dashboardData.recentSales.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No hay facturas emitidas registradas para esta empresa.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentSales.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            <Link
                              href={`/sales/invoices/${inv.id}`}
                              style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                            >
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {formatDate(inv.issue_date)}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-main)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.customer_name}
                          </td>
                          <td className="num-mono" style={{ fontWeight: 600 }}>
                            {formatCurrency(inv.total)}
                          </td>
                          <td
                            className="num-mono"
                            style={{
                              color: inv.balance_due > 0 ? '#fbbf24' : 'var(--text-dim)',
                            }}
                          >
                            {formatCurrency(inv.balance_due)}
                          </td>
                          <td>
                            <Badge status={inv.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Recent Purchases & Expenses Card */}
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                    Compras & Gastos Operativos
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Soportes de proveedores registrados
                  </span>
                </div>
                <Link
                  href="/purchases/expenses"
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  Ver todos
                </Link>
              </div>

              <div className="table-container">
                {dashboardData.recentPurchases.length === 0 ? (
                  <div
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No hay compras o gastos operativos registrados.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Proveedor</th>
                        <th>Categoría</th>
                        <th>Total</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentPurchases.map((pur) => (
                        <tr key={pur.id}>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                              {pur.document_number}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-main)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pur.supplier_name}
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                              {pur.category}
                            </span>
                          </td>
                          <td className="num-mono" style={{ fontWeight: 600 }}>
                            {formatCurrency(pur.total)}
                          </td>
                          <td
                            className="num-mono"
                            style={{
                              color: pur.balance_due > 0 ? '#f87171' : 'var(--text-dim)',
                            }}
                          >
                            {formatCurrency(pur.balance_due)}
                          </td>
                          <td>
                            <Badge status={pur.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* Recent Cash Movements & Collections */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
                  Últimos Movimientos de Cobros y Pagos
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  Flujo de fondos aplicado a facturas y obligaciones
                </span>
              </div>
              <Link
                href="/sales/payments"
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                Gestionar cobros
              </Link>
            </div>

            <div className="table-container">
              {dashboardData.recentPayments.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                  }}
                >
                  No hay movimientos de cobros o pagos registrados.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dirección</th>
                      <th>Fecha</th>
                      <th>Contraparte</th>
                      <th>Método</th>
                      <th>Referencia</th>
                      <th>Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recentPayments.map((pmt) => (
                      <tr key={pmt.id}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              color:
                                pmt.direction === 'inbound'
                                  ? 'var(--color-success)'
                                  : 'var(--color-danger)',
                            }}
                          >
                            {pmt.direction === 'inbound' ? (
                              <>
                                <ArrowDownRight size={14} /> Cobro Recibido
                              </>
                            ) : (
                              <>
                                <ArrowUpRight size={14} /> Desembolso
                              </>
                            )}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {formatDate(pmt.payment_date)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                          {pmt.entity_name || '-'}
                        </td>
                        <td style={{ fontSize: '12px' }}>{pmt.method}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                          {pmt.reference || '-'}
                        </td>
                        <td
                          className="num-mono"
                          style={{
                            fontWeight: 600,
                            color: pmt.direction === 'inbound' ? '#34d399' : '#f87171',
                          }}
                        >
                          {pmt.direction === 'inbound' ? '+' : '-'} {formatCurrency(pmt.amount)}
                        </td>
                        <td>
                          <Badge status={pmt.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
