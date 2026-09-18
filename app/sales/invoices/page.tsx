'use client';

// ============================================================================
// Paguro Finance - Sales Invoices Directory
// Real Supabase data, Multi-company isolated, RLS-enforced, Zero mock-store
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, Receipt, RefreshCw, AlertCircle, Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InvoiceWithCustomer } from '@/types/database';
import { getSalesInvoicesAction } from '@/lib/actions/invoices';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // User role
  const [userRole, setUserRole] = useState<string | null>(null);
  const canCreate = userRole ? WRITE_ROLES.includes(userRole) : false;

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

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getSalesInvoicesAction(searchTerm, statusFilter);
      if (res.success && res.data) {
        setInvoices(res.data);
      } else {
        setErrorMsg(res.error || 'Error al cargar las facturas.');
      }
    } catch (err: any) {
      console.error('[InvoicesPage] Error loading:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar facturas.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadInvoices]);

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
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="md" onClick={loadInvoices} icon={<RefreshCw size={15} />}>
            Actualizar
          </Button>
          {canCreate && (
            <Link href="/sales/invoices/new">
              <Button variant="primary" icon={<Plus size={16} />}>
                Nueva Factura
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Error alert */}
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
            { id: 'draft', label: 'Borradores' },
            { id: 'issued', label: 'Emitidas' },
            { id: 'partial', label: 'Abonadas' },
            { id: 'paid', label: 'Pagadas' },
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

      {/* Table / Empty State */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando facturas de venta...</div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--color-primary)',
            }}
          >
            <Receipt size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>
            No hay facturas de venta registradas
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'No se encontraron facturas que coincidan con los filtros aplicados.'
              : 'Comience creando una factura de venta para registrar ingresos, generar IVA y gestionar cuentas por cobrar.'}
          </p>
          {canCreate && !searchTerm && statusFilter === 'all' && (
            <Link href="/sales/invoices/new">
              <Button variant="primary" icon={<Plus size={16} />}>
                Crear Primera Factura
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha Emisión</th>
                <th>Vencimiento</th>
                <th>Subtotal</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Saldo Pendiente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const isOverdue = inv.balance_due > 0 && inv.status !== 'void' && new Date(inv.due_date) < new Date();

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
                        {inv.customer?.name || 'Cliente'}
                      </div>
                      <div className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {inv.customer?.tax_id}
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
                        color: inv.balance_due > 0 && inv.status !== 'void' ? '#fbbf24' : 'var(--text-dim)',
                      }}
                    >
                      {formatCurrency(inv.status === 'void' ? 0 : inv.balance_due)}
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
      )}
    </div>
  );
}
