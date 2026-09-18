// ============================================================================
// Paguro Finance - Financial Reports Suite
// Authoritative Real Supabase Data, 9 Real Reports, CSV Exports, Zero mock-store
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Calendar,
  Filter,
  BarChart3,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Package,
  Users,
  Building2,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import {
  ReportType,
  ReportFilterInput,
  SalesReportData,
  ExpensesReportData,
  AccountsReceivableReportData,
  AccountsPayableReportData,
  IvaReportData,
  InventoryReportData,
  CustomerBalancesReportData,
  SupplierBalancesReportData,
  ProductProfitabilityReportData,
} from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  getSalesReportAction,
  getExpensesReportAction,
  getAccountsReceivableReportAction,
  getAccountsPayableReportAction,
  getIvaReportAction,
  getInventoryReportAction,
  getCustomerBalancesReportAction,
  getSupplierBalancesReportAction,
  getProductProfitabilityReportAction,
  exportReportCsvAction,
} from '@/lib/actions/reports';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agingFilter, setAgingFilter] = useState<'all' | 'current' | '1_30' | '31_60' | '61_90' | '90_plus'>('all');

  // Report Data States
  const [salesData, setSalesData] = useState<SalesReportData | null>(null);
  const [expensesData, setExpensesData] = useState<ExpensesReportData | null>(null);
  const [arData, setArData] = useState<AccountsReceivableReportData | null>(null);
  const [apData, setApData] = useState<AccountsPayableReportData | null>(null);
  const [ivaData, setIvaData] = useState<IvaReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [custBalancesData, setCustBalancesData] = useState<CustomerBalancesReportData | null>(null);
  const [suppBalancesData, setSuppBalancesData] = useState<SupplierBalancesReportData | null>(null);
  const [profitabilityData, setProfitabilityData] = useState<ProductProfitabilityReportData | null>(null);

  const loadActiveReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const filterPayload: ReportFilterInput = {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      aging_bucket: agingFilter,
    };

    try {
      switch (activeReport) {
        case 'sales': {
          const res = await getSalesReportAction(filterPayload);
          if (res.success && res.data) setSalesData(res.data);
          else setError(res.error || 'Error al cargar reporte de ventas.');
          break;
        }
        case 'expenses': {
          const res = await getExpensesReportAction(filterPayload);
          if (res.success && res.data) setExpensesData(res.data);
          else setError(res.error || 'Error al cargar reporte de gastos.');
          break;
        }
        case 'cxc': {
          const res = await getAccountsReceivableReportAction(filterPayload);
          if (res.success && res.data) setArData(res.data);
          else setError(res.error || 'Error al cargar cartera.');
          break;
        }
        case 'cxp': {
          const res = await getAccountsPayableReportAction(filterPayload);
          if (res.success && res.data) setApData(res.data);
          else setError(res.error || 'Error al cargar cuentas por pagar.');
          break;
        }
        case 'iva': {
          const res = await getIvaReportAction(filterPayload);
          if (res.success && res.data) setIvaData(res.data);
          else setError(res.error || 'Error al cargar reporte de IVA.');
          break;
        }
        case 'inventory': {
          const res = await getInventoryReportAction(filterPayload);
          if (res.success && res.data) setInventoryData(res.data);
          else setError(res.error || 'Error al cargar reporte de inventario.');
          break;
        }
        case 'customer_balances': {
          const res = await getCustomerBalancesReportAction();
          if (res.success && res.data) setCustBalancesData(res.data);
          else setError(res.error || 'Error al cargar saldos de clientes.');
          break;
        }
        case 'supplier_balances': {
          const res = await getSupplierBalancesReportAction();
          if (res.success && res.data) setSuppBalancesData(res.data);
          else setError(res.error || 'Error al cargar saldos de proveedores.');
          break;
        }
        case 'profitability': {
          const res = await getProductProfitabilityReportAction();
          if (res.success && res.data) setProfitabilityData(res.data);
          else setError(res.error || 'Error al cargar reporte de rentabilidad.');
          break;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado al generar reporte.');
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateFrom, dateTo, agingFilter]);

  useEffect(() => {
    loadActiveReport();
  }, [loadActiveReport]);

  // CSV Export Handler
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await exportReportCsvAction(activeReport, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        aging_bucket: agingFilter,
      });

      if (res.success && res.data) {
        const blob = new Blob([res.data.csv_content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.data.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error || 'Error al exportar archivo CSV.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al descargar archivo.');
    } finally {
      setExporting(false);
    }
  };

  const getAgingBadge = (bucket: string) => {
    switch (bucket) {
      case 'current':
        return <Badge variant="success">Al Día</Badge>;
      case '1_30':
        return <Badge variant="warning">1-30 Días</Badge>;
      case '31_60':
        return <Badge variant="warning">31-60 Días</Badge>;
      case '61_90':
        return <Badge variant="danger">61-90 Días</Badge>;
      case '90_plus':
        return <Badge variant="danger">+90 Días</Badge>;
      default:
        return <Badge variant="neutral">{bucket}</Badge>;
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-white)' }}>
            Informes y Reportes Financieros
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Consolidados financieros, estados de cartera, cuentas por pagar y balances derivados de Supabase.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" icon={<RefreshCw size={14} />} onClick={loadActiveReport} disabled={loading}>
            Actualizar
          </Button>

          <Button
            variant="primary"
            icon={<Download size={15} />}
            onClick={handleExportCSV}
            disabled={loading || exporting}
          >
            {exporting ? 'Generando CSV...' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '20px',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'sales', label: 'Ventas por Período' },
          { id: 'expenses', label: 'Gastos por Período' },
          { id: 'cxc', label: 'Cuentas por Cobrar (A/R)' },
          { id: 'cxp', label: 'Cuentas por Pagar (A/P)' },
          { id: 'iva', label: 'Resumen de IVA' },
          { id: 'inventory', label: 'Inventario y Valoración' },
          { id: 'customer_balances', label: 'Saldos Clientes' },
          { id: 'supplier_balances', label: 'Saldos Proveedores' },
          { id: 'profitability', label: 'Rentabilidad Productos' },
        ].map((tab) => {
          const isActive = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id as ReportType)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: 'var(--bg-secondary)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={16} color="var(--text-dim)" />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Desde:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-white)',
              fontSize: '12px',
            }}
          />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Hasta:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-white)',
              fontSize: '12px',
            }}
          />

          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
            >
              Limpiar Fechas
            </Button>
          )}
        </div>

        {/* Aging Filter for A/R and A/P */}
        {(activeReport === 'cxc' || activeReport === 'cxp') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tramo de Mora:</span>
            <select
              value={agingFilter}
              onChange={(e) => setAgingFilter(e.target.value as any)}
              style={{
                padding: '6px 10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-white)',
                fontSize: '12px',
              }}
            >
              <option value="all">Todos los Tramos</option>
              <option value="current">Al Día (Sin Vencer)</option>
              <option value="1_30">1 a 30 Días</option>
              <option value="31_60">31 a 60 Días</option>
              <option value="61_90">61 a 90 Días</option>
              <option value="90_plus">+90 Días</option>
            </select>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 1. SALES REPORT VIEW */}
      {activeReport === 'sales' && (
        <div>
          {salesData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total Facturado" value={formatCurrency(salesData.summary.total_invoiced)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Subtotal Gravable" value={formatCurrency(salesData.summary.total_subtotal)} icon={<TrendingUp size={20} />} trend="neutral" />
              <StatCard label="IVA Generado" value={formatCurrency(salesData.summary.total_tax)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Total Recaudado" value={formatCurrency(salesData.summary.total_collected)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="Saldo por Cobrar" value={formatCurrency(salesData.summary.total_balance_due)} icon={<Clock size={20} />} trend={salesData.summary.total_balance_due > 0 ? 'down' : 'neutral'} />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Factura</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Cliente</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Emisión</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Vencimiento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>IVA</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando ventas...</td></tr>
                ) : !salesData || salesData.items.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No se registraron ventas en el período.</td></tr>
                ) : (
                  salesData.items.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{i.invoice_number}</td>
                      <td style={{ padding: '14px 16px' }}>{i.customer_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(i.issue_date)}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(i.due_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(i.subtotal)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(i.tax_total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-white)' }}>{formatCurrency(i.total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: i.balance_due > 0 ? '#f87171' : '#34d399' }}>{formatCurrency(i.balance_due)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Badge variant={i.status === 'paid' ? 'success' : i.status === 'partial' ? 'warning' : 'neutral'}>
                          {i.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. EXPENSES REPORT VIEW */}
      {activeReport === 'expenses' && (
        <div>
          {expensesData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total Gastos" value={formatCurrency(expensesData.summary.total_expenses)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Subtotal Gastos" value={formatCurrency(expensesData.summary.total_subtotal)} icon={<TrendingDown size={20} />} trend="neutral" />
              <StatCard label="IVA Descontable" value={formatCurrency(expensesData.summary.total_tax)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Total Pagado" value={formatCurrency(expensesData.summary.total_paid)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="Saldo Pendiente" value={formatCurrency(expensesData.summary.total_balance_due)} icon={<Clock size={20} />} trend={expensesData.summary.total_balance_due > 0 ? 'down' : 'neutral'} />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Documento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Proveedor</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Categoría</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Fecha</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>IVA Desc.</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando gastos...</td></tr>
                ) : !expensesData || expensesData.items.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No se registraron gastos en el período.</td></tr>
                ) : (
                  expensesData.items.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{p.document_number}</td>
                      <td style={{ padding: '14px 16px' }}>{p.supplier_name}</td>
                      <td style={{ padding: '14px 16px' }}><Badge variant="neutral">{p.category.toUpperCase()}</Badge></td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(p.document_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(p.subtotal)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(p.tax_total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-white)' }}>{formatCurrency(p.total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: p.balance_due > 0 ? '#f87171' : '#34d399' }}>{formatCurrency(p.balance_due)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Badge variant={p.status === 'paid' ? 'success' : p.status === 'partial' ? 'warning' : 'neutral'}>
                          {p.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ACCOUNTS RECEIVABLE REPORT (A/R) */}
      {activeReport === 'cxc' && (
        <div>
          {arData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Cartera Total" value={formatCurrency(arData.summary.total_receivable)} icon={<Clock size={20} />} trend="neutral" />
              <StatCard label="Al Día" value={formatCurrency(arData.summary.current_amount)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="1 - 30 Días" value={formatCurrency(arData.summary.overdue_1_30)} icon={<Clock size={20} />} trend="neutral" />
              <StatCard label="31 - 60 Días" value={formatCurrency(arData.summary.overdue_31_60)} icon={<Clock size={20} />} trend="down" />
              <StatCard label="61 - 90 Días" value={formatCurrency(arData.summary.overdue_61_90)} icon={<Clock size={20} />} trend="down" />
              <StatCard label="+90 Días" value={formatCurrency(arData.summary.overdue_90_plus)} icon={<AlertCircle size={20} />} trend="down" />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Cliente</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>NIT</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Factura</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Vencimiento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Días Mora</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Tramo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Factura</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cartera...</td></tr>
                ) : !arData || arData.items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay saldos pendientes por cobrar. ¡Excelente recaudo!</td></tr>
                ) : (
                  arData.items.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{i.customer_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{i.customer_tax_id || 'N/A'}</td>
                      <td style={{ padding: '14px 16px' }}>{i.invoice_number}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(i.due_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: i.days_overdue > 0 ? '#f87171' : '#34d399' }}>
                        {i.days_overdue > 0 ? `${i.days_overdue} d` : '0'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>{getAgingBadge(i.aging_bucket)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(i.total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>{formatCurrency(i.balance_due)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ACCOUNTS PAYABLE REPORT (A/P) */}
      {activeReport === 'cxp' && (
        <div>
          {apData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Cuentas por Pagar" value={formatCurrency(apData.summary.total_payable)} icon={<Clock size={20} />} trend="neutral" />
              <StatCard label="Al Día" value={formatCurrency(apData.summary.current_amount)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="1 - 30 Días" value={formatCurrency(apData.summary.overdue_1_30)} icon={<Clock size={20} />} trend="neutral" />
              <StatCard label="31 - 60 Días" value={formatCurrency(apData.summary.overdue_31_60)} icon={<Clock size={20} />} trend="down" />
              <StatCard label="61 - 90 Días" value={formatCurrency(apData.summary.overdue_61_90)} icon={<Clock size={20} />} trend="down" />
              <StatCard label="+90 Días" value={formatCurrency(apData.summary.overdue_90_plus)} icon={<AlertCircle size={20} />} trend="down" />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Proveedor</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>NIT</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Documento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Vencimiento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Días Mora</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Tramo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Gasto</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cuentas por pagar...</td></tr>
                ) : !apData || apData.items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay obligaciones pendientes con proveedores.</td></tr>
                ) : (
                  apData.items.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{p.supplier_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{p.supplier_tax_id || 'N/A'}</td>
                      <td style={{ padding: '14px 16px' }}>{p.document_number}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(p.due_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: p.days_overdue > 0 ? '#f87171' : '#34d399' }}>
                        {p.days_overdue > 0 ? `${p.days_overdue} d` : '0'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>{getAgingBadge(p.aging_bucket)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(p.total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: '#f87171' }}>{formatCurrency(p.balance_due)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. IVA SUMMARY REPORT */}
      {activeReport === 'iva' && (
        <div>
          {ivaData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="IVA Generado (Ventas)" value={formatCurrency(ivaData.summary.total_sales_vat)} icon={<TrendingUp size={20} />} trend="up" />
              <StatCard label="IVA Descontable (Compras)" value={formatCurrency(ivaData.summary.total_purchases_vat)} icon={<TrendingDown size={20} />} trend="down" />
              <StatCard label="Ajustes Netos" value={formatCurrency(ivaData.summary.total_adjustments)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard
                label="IVA Estimado a Pagar"
                value={formatCurrency(ivaData.summary.estimated_vat_payable)}
                icon={<DollarSign size={20} />}
                trend={ivaData.summary.estimated_vat_payable >= 0 ? 'down' : 'up'}
              />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Período</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Rango de Fechas</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>IVA Generado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>IVA Descontable</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Ajustes</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Neto a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando IVA...</td></tr>
                ) : !ivaData || ivaData.items.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay periodos tributarios configurados.</td></tr>
                ) : (
                  ivaData.items.map((i) => (
                    <tr key={i.period_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{i.period_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{formatDate(i.start_date)} - {formatDate(i.end_date)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Badge variant={i.status === 'closed' ? 'success' : i.status === 'reviewed' ? 'info' : 'neutral'}>
                          {i.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#60a5fa' }}>{formatCurrency(i.sales_vat)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: '#34d399' }}>{formatCurrency(i.purchases_vat)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(i.adjustments_total)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: i.net_vat >= 0 ? '#f87171' : '#34d399' }}>
                        {formatCurrency(i.net_vat)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. INVENTORY & VALUATION REPORT */}
      {activeReport === 'inventory' && (
        <div>
          {inventoryData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total SKUs Activos" value={inventoryData.summary.total_skus.toString()} icon={<Package size={20} />} trend="neutral" />
              <StatCard label="Unidades en Existencia" value={inventoryData.summary.total_units.toLocaleString('es-CO')} icon={<Package size={20} />} trend="neutral" />
              <StatCard label="Valoración de Inventario" value={formatCurrency(inventoryData.summary.total_valuation)} icon={<DollarSign size={20} />} trend="up" />
              <StatCard label="Productos Bajo Stock" value={inventoryData.summary.low_stock_count.toString()} icon={<AlertCircle size={20} />} trend={inventoryData.summary.low_stock_count > 0 ? 'down' : 'up'} />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>SKU</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Producto</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Categoría</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Stock Actual</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Stock Mínimo</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Costo Unitario</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Valoración Total</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Alerta Stock</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando inventario...</td></tr>
                ) : !inventoryData || inventoryData.items.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay productos activos en inventario.</td></tr>
                ) : (
                  inventoryData.items.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>{p.sku}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{p.category_name}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: p.current_stock > 0 ? 'var(--text-white)' : '#f87171' }}>
                        {p.current_stock.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.minimum_stock.toLocaleString('es-CO')}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(p.unit_cost)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-white)' }}>{formatCurrency(p.valuation)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {p.is_low_stock ? (
                          <Badge variant="danger">Bajo Stock</Badge>
                        ) : (
                          <Badge variant="success">Normal</Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. CUSTOMER BALANCES REPORT */}
      {activeReport === 'customer_balances' && (
        <div>
          {custBalancesData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total Clientes" value={custBalancesData.summary.total_customers.toString()} icon={<Users size={20} />} trend="neutral" />
              <StatCard label="Total Facturado" value={formatCurrency(custBalancesData.summary.total_invoiced)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Total Recaudado" value={formatCurrency(custBalancesData.summary.total_collected)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="Saldo Total Pendiente" value={formatCurrency(custBalancesData.summary.total_outstanding)} icon={<Clock size={20} />} trend={custBalancesData.summary.total_outstanding > 0 ? 'down' : 'neutral'} />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Cliente</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>NIT / Documento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Pagado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo Pendiente</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Facturas Abiertas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando saldos...</td></tr>
                ) : !custBalancesData || custBalancesData.items.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay clientes registrados.</td></tr>
                ) : (
                  custBalancesData.items.map((c) => (
                    <tr key={c.customer_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{c.customer_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{c.customer_tax_id || 'N/A'}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(c.total_invoiced)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(c.total_paid)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: c.current_balance > 0 ? '#f87171' : '#34d399' }}>
                        {formatCurrency(c.current_balance)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Badge variant={c.open_invoices_count > 0 ? 'warning' : 'neutral'}>
                          {c.open_invoices_count}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. SUPPLIER BALANCES REPORT */}
      {activeReport === 'supplier_balances' && (
        <div>
          {suppBalancesData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total Proveedores" value={suppBalancesData.summary.total_suppliers.toString()} icon={<Building2 size={20} />} trend="neutral" />
              <StatCard label="Total Facturado" value={formatCurrency(suppBalancesData.summary.total_billed)} icon={<DollarSign size={20} />} trend="neutral" />
              <StatCard label="Total Pagado" value={formatCurrency(suppBalancesData.summary.total_paid)} icon={<CheckCircle2 size={20} />} trend="up" />
              <StatCard label="Saldo Total Pendiente" value={formatCurrency(suppBalancesData.summary.total_outstanding)} icon={<Clock size={20} />} trend={suppBalancesData.summary.total_outstanding > 0 ? 'down' : 'neutral'} />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Proveedor</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>NIT / Documento</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Total Pagado</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Saldo Pendiente</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>Facturas Abiertas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando saldos...</td></tr>
                ) : !suppBalancesData || suppBalancesData.items.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay proveedores registrados.</td></tr>
                ) : (
                  suppBalancesData.items.map((s) => (
                    <tr key={s.supplier_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{s.supplier_name}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{s.supplier_tax_id || 'N/A'}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(s.total_billed)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{formatCurrency(s.total_paid)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: s.current_balance > 0 ? '#f87171' : '#34d399' }}>
                        {formatCurrency(s.current_balance)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <Badge variant={s.open_bills_count > 0 ? 'warning' : 'neutral'}>
                          {s.open_bills_count}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. PRODUCT PROFITABILITY REPORT */}
      {activeReport === 'profitability' && (
        <div>
          {profitabilityData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Unidades Vendidas" value={profitabilityData.summary.total_units_sold.toLocaleString('es-CO')} icon={<Package size={20} />} trend="neutral" />
              <StatCard label="Ingresos Ventas" value={formatCurrency(profitabilityData.summary.total_revenue)} icon={<TrendingUp size={20} />} trend="up" />
              <StatCard label="Costo Mercancía (COGS)" value={formatCurrency(profitabilityData.summary.total_cogs)} icon={<TrendingDown size={20} />} trend="neutral" />
              <StatCard label="Ganancia Bruta" value={formatCurrency(profitabilityData.summary.total_gross_profit)} icon={<DollarSign size={20} />} trend="up" />
              <StatCard label="Margen Bruto General" value={`${profitabilityData.summary.overall_margin_pct}%`} icon={<Percent size={20} />} trend="up" />
            </div>
          )}

          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>SKU</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Producto</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Unidades Vendidas</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Ingresos</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Costo (COGS)</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Ganancia Bruta</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Margen (%)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando rentabilidad...</td></tr>
                ) : !profitabilityData || profitabilityData.items.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay ventas registradas para calcular rentabilidad.</td></tr>
                ) : (
                  profitabilityData.items.map((p) => (
                    <tr key={p.product_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>{p.sku}</td>
                      <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-white)' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>{p.units_sold.toLocaleString('es-CO')}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.revenue)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(p.cogs)}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: p.gross_profit >= 0 ? '#34d399' : '#f87171' }}>
                        {formatCurrency(p.gross_profit)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: p.gross_margin_pct >= 20 ? '#34d399' : '#fbbf24' }}>
                        {p.gross_margin_pct}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
