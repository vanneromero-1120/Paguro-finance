'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Receipt, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_INVOICES, INITIAL_CUSTOMERS } from '@/lib/supabase/mock-store';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = invoices.filter((inv) => {
    const customer = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'unpaid') return inv.balance_due > 0 && inv.status !== 'void';
    return inv.status === statusFilter;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Facturas de Venta & Cuentas por Cobrar
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Facturas emitidas, cálculo de IVA generado, control de vencimientos y saldos abiertos.
          </p>
        </div>
        <Link href="/sales/invoices/new">
          <Button variant="primary" icon={<Plus size={16} />}>
            Nueva Factura
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '360px' }}>
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Buscar por número o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'unpaid', label: 'Pendientes / Saldo' },
            { id: 'paid', label: 'Pagadas' },
            { id: 'draft', label: 'Borradores' },
            { id: 'void', label: 'Anuladas' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setStatusFilter(pill.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: statusFilter === pill.id ? 600 : 400,
                backgroundColor: statusFilter === pill.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: statusFilter === pill.id ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Fecha Emisión</th>
              <th>Vencimiento</th>
              <th>Subtotal</th>
              <th>IVA (19%)</th>
              <th>Total</th>
              <th>Saldo Pendiente</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => {
              const customer = INITIAL_CUSTOMERS.find((c) => c.id === inv.customer_id);
              const isOverdue = inv.balance_due > 0 && new Date(inv.due_date) < new Date();

              return (
                <tr key={inv.id}>
                  <td>
                    <Link
                      href={`/sales/invoices/${inv.id}`}
                      style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                    >
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {customer?.name || 'Cliente'}
                    </div>
                    <div className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {customer?.tax_id}
                    </div>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(inv.issue_date)}
                  </td>
                  <td style={{ fontSize: '12px', color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
                    {formatDate(inv.due_date)} {isOverdue && '(!)'}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {formatCurrency(inv.subtotal)}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {formatCurrency(inv.tax_total)}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                    {formatCurrency(inv.total)}
                  </td>
                  <td
                    className="num-mono"
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: inv.balance_due > 0 ? '#fbbf24' : 'var(--text-dim)',
                    }}
                  >
                    {formatCurrency(inv.balance_due)}
                  </td>
                  <td>
                    <Badge status={inv.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
