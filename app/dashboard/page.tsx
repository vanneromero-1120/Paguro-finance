'use client';

import React, { useState } from 'react';
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
  Calendar,
  Percent,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  INITIAL_INVOICES,
  INITIAL_PURCHASES,
  INITIAL_PRODUCTS,
  INITIAL_MOVEMENTS,
  INITIAL_PAYMENTS,
} from '@/lib/supabase/mock-store';
import { deriveProductStock, isLowStock } from '@/lib/finance/inventory';

export default function DashboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Compute live KPIs from operational data
  const validInvoices = INITIAL_INVOICES.filter((inv) => inv.status !== 'void');
  const netSales = validInvoices.reduce((acc, inv) => acc + inv.subtotal, 0);
  const accountsReceivable = validInvoices.reduce((acc, inv) => acc + inv.balance_due, 0);
  const overdueInvoices = validInvoices.filter(
    (inv) => inv.balance_due > 0 && new Date(inv.due_date) < new Date()
  );

  const validPurchases = INITIAL_PURCHASES.filter((p) => p.status !== 'void');
  const totalExpenses = validPurchases.reduce((acc, p) => acc + p.subtotal, 0);
  const accountsPayable = validPurchases.reduce((acc, p) => acc + p.balance_due, 0);

  // VAT calculations
  const generatedVat = validInvoices.reduce((acc, inv) => acc + inv.tax_total, 0);
  const deductibleVat = validPurchases.reduce((acc, p) => acc + p.deductible_tax_total, 0);
  const estimatedVatPayable = Math.max(0, generatedVat - deductibleVat);

  // Inventory valuation
  let totalInventoryValuation = 0;
  let lowStockProductsCount = 0;

  for (const product of INITIAL_PRODUCTS) {
    if (product.is_inventory_item) {
      const productMovements = INITIAL_MOVEMENTS.filter((m) => m.product_id === product.id);
      const stock = deriveProductStock(productMovements);
      totalInventoryValuation += stock * product.cost;
      if (isLowStock(stock, product.stock_minimum)) {
        lowStockProductsCount += 1;
      }
    }
  }

  // Gross operating margin
  const grossMargin = netSales - totalExpenses;
  const grossMarginPercent = netSales > 0 ? (grossMargin / netSales) * 100 : 0;

  return (
    <div>
      {/* Top Welcome & Period Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
            Panel de Control Financiero
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Métricas consolidadas de facturación, compras, IVA, inventario y flujo de caja operativo.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  backgroundColor: selectedPeriod === period ? 'var(--color-primary)' : 'transparent',
                  color: selectedPeriod === period ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                }}
              >
                {period === 'month' ? 'Este Mes' : period === 'quarter' ? 'Este Trimestre' : 'Año 2026'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Alert Banners (if any) */}
      {lowStockProductsCount > 0 && (
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
              Alerta de inventario: Hay <strong>{lowStockProductsCount} producto(s)</strong> en o por debajo del stock mínimo de seguridad.
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
            }}
          >
            Ver catálogo <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Core KPI Grid */}
      <div className="kpi-grid">
        <StatCard
          title="Ventas Netas"
          value={formatCurrency(netSales)}
          subtitle="Facturas emitidas válidas"
          icon={<Receipt size={18} />}
          highlightColor="primary"
          trend={{ value: '+12.4% vs mes anterior', isPositive: true }}
        />

        <StatCard
          title="Gastos & Compras"
          value={formatCurrency(totalExpenses)}
          subtitle="Soportes y gastos registrados"
          icon={<ShoppingBag size={18} />}
          highlightColor="danger"
          trend={{ value: '-3.8% optimización', isPositive: true }}
        />

        <StatCard
          title="Margen Operativo"
          value={formatCurrency(grossMargin)}
          subtitle={`${grossMarginPercent.toFixed(1)}% margen bruto`}
          icon={<TrendingUp size={18} />}
          highlightColor="success"
        />

        <StatCard
          title="Cuentas por Cobrar (CxC)"
          value={formatCurrency(accountsReceivable)}
          subtitle={`${validInvoices.filter(i => i.balance_due > 0).length} factura(s) con saldo abierto`}
          icon={<CreditCard size={18} />}
          highlightColor="warning"
        />

        <StatCard
          title="Cuentas por Pagar (CxP)"
          value={formatCurrency(accountsPayable)}
          subtitle="Obligaciones a proveedores"
          icon={<DollarSign size={18} />}
          highlightColor="danger"
        />

        <StatCard
          title="IVA Estimado a Pagar"
          value={formatCurrency(estimatedVatPayable)}
          subtitle={`Generado: ${formatCurrency(generatedVat)} | Descontable: ${formatCurrency(deductibleVat)}`}
          icon={<Percent size={18} />}
          highlightColor="purple"
        />

        <StatCard
          title="Valoración de Inventario"
          value={formatCurrency(totalInventoryValuation)}
          subtitle={`${INITIAL_PRODUCTS.length} referencias registradas`}
          icon={<Package size={18} />}
          highlightColor="primary"
        />
      </div>

      {/* Two Column Layout: Recent Sales & Recent Expenses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Recent Invoices Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {INITIAL_INVOICES.map((inv) => (
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
                    <td className="num-mono" style={{ fontWeight: 600 }}>
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="num-mono" style={{ color: inv.balance_due > 0 ? '#fbbf24' : 'var(--text-dim)' }}>
                      {formatCurrency(inv.balance_due)}
                    </td>
                    <td>
                      <Badge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchases & Expenses Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Categoría</th>
                  <th>Total</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {INITIAL_PURCHASES.map((pur) => (
                  <tr key={pur.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                        {pur.document_number}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {pur.category}
                      </span>
                    </td>
                    <td className="num-mono" style={{ fontWeight: 600 }}>
                      {formatCurrency(pur.total)}
                    </td>
                    <td className="num-mono" style={{ color: pur.balance_due > 0 ? '#f87171' : 'var(--text-dim)' }}>
                      {formatCurrency(pur.balance_due)}
                    </td>
                    <td>
                      <Badge status={pur.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Cash Movements & Collections */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
          <table className="data-table">
            <thead>
              <tr>
                <th>Dirección</th>
                <th>Fecha</th>
                <th>Método</th>
                <th>Referencia</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {INITIAL_PAYMENTS.map((pmt) => (
                <tr key={pmt.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: pmt.direction === 'inbound' ? 'var(--color-success)' : 'var(--color-danger)',
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
                  <td style={{ fontSize: '12px' }}>{pmt.method}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{pmt.reference || '-'}</td>
                  <td className="num-mono" style={{ fontWeight: 600, color: pmt.direction === 'inbound' ? '#34d399' : '#f87171' }}>
                    {pmt.direction === 'inbound' ? '+' : '-'} {formatCurrency(pmt.amount)}
                  </td>
                  <td>
                    <Badge status={pmt.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
