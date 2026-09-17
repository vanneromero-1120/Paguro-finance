'use client';

import React, { useState } from 'react';
import { Download, FileText, Calendar, Filter, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  INITIAL_INVOICES,
  INITIAL_PURCHASES,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PRODUCTS,
  INITIAL_MOVEMENTS,
} from '@/lib/supabase/mock-store';
import { deriveProductStock } from '@/lib/finance/inventory';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState<'sales' | 'expenses' | 'cxc' | 'cxp' | 'inventory'>('sales');

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map(val => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (activeReport === 'sales') {
      const headers = ['Factura', 'Cliente', 'Fecha Emision', 'Vencimiento', 'Subtotal', 'IVA', 'Total', 'Saldo', 'Estado'];
      const rows = INITIAL_INVOICES.map((inv) => {
        const cust = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
        return [
          inv.invoice_number,
          cust?.name || 'Cliente',
          inv.issue_date,
          inv.due_date,
          inv.subtotal,
          inv.tax_total,
          inv.total,
          inv.balance_due,
          inv.status,
        ];
      });
      downloadCSV('reporte_ventas_paguro', headers, rows);
    } else if (activeReport === 'expenses') {
      const headers = ['Documento', 'Proveedor', 'Categoria', 'Fecha', 'Subtotal', 'IVA Descontable', 'Total', 'Saldo', 'Estado'];
      const rows = INITIAL_PURCHASES.map((p) => {
        const supp = INITIAL_SUPPLIERS.find((s) => s.id === p.supplier_id);
        return [
          p.document_number,
          supp?.name || 'Proveedor',
          p.category,
          p.document_date,
          p.subtotal,
          p.deductible_tax_total,
          p.total,
          p.balance_due,
          p.status,
        ];
      });
      downloadCSV('reporte_gastos_paguro', headers, rows);
    } else if (activeReport === 'cxc') {
      const headers = ['Cliente', 'NIT', 'Factura', 'Fecha Emision', 'Vencimiento', 'Total Factura', 'Saldo Pendiente'];
      const rows = INITIAL_INVOICES.filter(i => i.balance_due > 0).map((inv) => {
        const cust = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
        return [
          cust?.name || 'Cliente',
          cust?.tax_id || '',
          inv.invoice_number,
          inv.issue_date,
          inv.due_date,
          inv.total,
          inv.balance_due,
        ];
      });
      downloadCSV('reporte_cxc_saldos', headers, rows);
    } else if (activeReport === 'cxp') {
      const headers = ['Proveedor', 'NIT', 'Documento', 'Fecha', 'Vencimiento', 'Total Gasto', 'Saldo Pendiente'];
      const rows = INITIAL_PURCHASES.filter(p => p.balance_due > 0).map((pur) => {
        const supp = INITIAL_SUPPLIERS.find((s) => s.id === pur.supplier_id);
        return [
          supp?.name || 'Proveedor',
          supp?.tax_id || '',
          pur.document_number,
          pur.document_date,
          pur.due_date,
          pur.total,
          pur.balance_due,
        ];
      });
      downloadCSV('reporte_cxp_saldos', headers, rows);
    } else if (activeReport === 'inventory') {
      const headers = ['SKU', 'Producto', 'Categoria', 'Stock Actual', 'Costo Unitario', 'Valor Total'];
      const rows = INITIAL_PRODUCTS.map((prod) => {
        const movements = INITIAL_MOVEMENTS.filter((m) => m.product_id === prod.id);
        const stock = deriveProductStock(movements);
        return [
          prod.sku,
          prod.name,
          prod.category || 'General',
          stock,
          prod.cost,
          stock * prod.cost,
        ];
      });
      downloadCSV('reporte_inventario_valorizado', headers, rows);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Informes & Reportes Financieros
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Consolidados de ventas, gastos, carteras por cobrar y pagar, e inventario valorizado.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Download size={16} />}
          onClick={handleExport}
        >
          Exportar a CSV / Excel
        </Button>
      </div>

      {/* Report Selection Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'sales', label: 'Ventas por Periodo' },
          { id: 'expenses', label: 'Gastos por Periodo' },
          { id: 'cxc', label: 'Cuentas por Cobrar (CxC)' },
          { id: 'cxp', label: 'Cuentas por Pagar (CxP)' },
          { id: 'inventory', label: 'Valoración de Inventario' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontSize: '13px',
              fontWeight: activeReport === tab.id ? 600 : 400,
              backgroundColor: activeReport === tab.id ? 'var(--color-primary)' : 'var(--bg-card)',
              color: activeReport === tab.id ? '#ffffff' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Display Container */}
      <div className="card">
        {activeReport === 'sales' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
              Reporte de Facturación y Ventas
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Cliente</th>
                    <th>Emisión</th>
                    <th>Subtotal</th>
                    <th>IVA</th>
                    <th>Total</th>
                    <th>Saldo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_INVOICES.map((inv) => {
                    const cust = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                        <td>{cust?.name}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(inv.issue_date)}</td>
                        <td className="num-mono">{formatCurrency(inv.subtotal)}</td>
                        <td className="num-mono">{formatCurrency(inv.tax_total)}</td>
                        <td className="num-mono" style={{ fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                        <td className="num-mono">{formatCurrency(inv.balance_due)}</td>
                        <td>{inv.status.toUpperCase()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'expenses' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
              Reporte de Compras y Gastos Operativos
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Proveedor</th>
                    <th>Categoría</th>
                    <th>Fecha</th>
                    <th>Subtotal</th>
                    <th>IVA Descontable</th>
                    <th>Total</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_PURCHASES.map((pur) => {
                    const supp = INITIAL_SUPPLIERS.find((s) => s.id === pur.supplier_id);
                    return (
                      <tr key={pur.id}>
                        <td style={{ fontWeight: 600 }}>{pur.document_number}</td>
                        <td>{supp?.name}</td>
                        <td>{pur.category}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(pur.document_date)}</td>
                        <td className="num-mono">{formatCurrency(pur.subtotal)}</td>
                        <td className="num-mono" style={{ color: '#c084fc' }}>{formatCurrency(pur.deductible_tax_total)}</td>
                        <td className="num-mono" style={{ fontWeight: 600 }}>{formatCurrency(pur.total)}</td>
                        <td className="num-mono">{formatCurrency(pur.balance_due)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'cxc' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
              Cartera de Clientes - Cuentas por Cobrar (CxC)
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>NIT</th>
                    <th>Factura</th>
                    <th>Vencimiento</th>
                    <th>Total Factura</th>
                    <th>Saldo por Cobrar</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_INVOICES.filter((i) => i.balance_due > 0).map((inv) => {
                    const cust = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600 }}>{cust?.name}</td>
                        <td className="num-mono" style={{ fontSize: '12px' }}>{cust?.tax_id}</td>
                        <td>{inv.invoice_number}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(inv.due_date)}</td>
                        <td className="num-mono">{formatCurrency(inv.total)}</td>
                        <td className="num-mono" style={{ fontWeight: 700, color: '#fbbf24' }}>
                          {formatCurrency(inv.balance_due)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'cxp' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
              Cuentas por Pagar a Proveedores (CxP)
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>NIT</th>
                    <th>Documento</th>
                    <th>Vencimiento</th>
                    <th>Total Obligación</th>
                    <th>Saldo por Pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_PURCHASES.filter((p) => p.balance_due > 0).map((pur) => {
                    const supp = INITIAL_SUPPLIERS.find((s) => s.id === pur.supplier_id);
                    return (
                      <tr key={pur.id}>
                        <td style={{ fontWeight: 600 }}>{supp?.name}</td>
                        <td className="num-mono" style={{ fontSize: '12px' }}>{supp?.tax_id}</td>
                        <td>{pur.document_number}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(pur.due_date)}</td>
                        <td className="num-mono">{formatCurrency(pur.total)}</td>
                        <td className="num-mono" style={{ fontWeight: 700, color: '#f87171' }}>
                          {formatCurrency(pur.balance_due)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'inventory' && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
              Estado y Valoración de Inventario
            </h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock Actual</th>
                    <th>Costo Unitario</th>
                    <th>Valor Total en Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {INITIAL_PRODUCTS.map((prod) => {
                    const movements = INITIAL_MOVEMENTS.filter((m) => m.product_id === prod.id);
                    const stock = deriveProductStock(movements);
                    return (
                      <tr key={prod.id}>
                        <td className="num-mono" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                          {prod.sku}
                        </td>
                        <td style={{ fontWeight: 600 }}>{prod.name}</td>
                        <td>{prod.category}</td>
                        <td className="num-mono" style={{ fontWeight: 700 }}>{stock}</td>
                        <td className="num-mono">{formatCurrency(prod.cost)}</td>
                        <td className="num-mono" style={{ fontWeight: 700, color: 'var(--text-white)' }}>
                          {formatCurrency(stock * prod.cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
