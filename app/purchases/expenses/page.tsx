'use client';

// ============================================================================
// Paguro Finance - Purchases & Expenses Directory (CxP)
// Real Supabase data, Multi-company isolated, RLS-enforced, Zero mock-store
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, ShoppingBag, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PurchaseDocumentWithSupplier } from '@/types/database';
import { getPurchaseDocumentsAction } from '@/lib/actions/purchases';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

export default function ExpensesPage() {
  const [purchases, setPurchases] = useState<PurchaseDocumentWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
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

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getPurchaseDocumentsAction(
        searchTerm,
        statusFilter,
        categoryFilter !== 'all' ? categoryFilter : undefined
      );
      if (res.success && res.data) {
        setPurchases(res.data);
      } else {
        setErrorMsg(res.error || 'Error al cargar los documentos de compra.');
      }
    } catch (err: any) {
      console.error('[ExpensesPage] Error loading:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar gastos y compras.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPurchases();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadPurchases]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Gastos & Facturas de Compra (CxP)
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro de gastos operativos, facturas de proveedores, IVA descontable y pagos pendientes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="md" onClick={loadPurchases} icon={<RefreshCw size={15} />}>
            Actualizar
          </Button>
          {canCreate && (
            <Link href="/purchases/expenses/new">
              <Button variant="primary" icon={<Plus size={16} />}>
                Registrar Gasto / Compra
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
            placeholder="Buscar por soporte, proveedor o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status & Category Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'unpaid', label: 'Pendientes / Saldo' },
            { id: 'open', label: 'Abiertos' },
            { id: 'partial', label: 'Abonados' },
            { id: 'paid', label: 'Pagados' },
            { id: 'draft', label: 'Borradores' },
            { id: 'void', label: 'Anulados' },
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
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando gastos y facturas de compra...</div>
        </div>
      ) : purchases.length === 0 ? (
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
            <ShoppingBag size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>
            No hay gastos ni facturas de compra registradas
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'No se encontraron documentos que coincidan con los filtros aplicados.'
              : 'Comience registrando compras o gastos operativos con sus respectivos soportes e IVA descontable.'}
          </p>
          {canCreate && !searchTerm && statusFilter === 'all' && (
            <Link href="/purchases/expenses/new">
              <Button variant="primary" icon={<Plus size={16} />}>
                Registrar Primer Gasto / Compra
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Documento / Soporte</th>
                <th>Proveedor</th>
                <th>Categoría</th>
                <th>Fecha Emisión</th>
                <th>Vencimiento</th>
                <th>Subtotal</th>
                <th>IVA Descontable</th>
                <th>Total</th>
                <th>Saldo Pendiente</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const isOverdue = p.balance_due > 0 && p.status !== 'void' && new Date(p.due_date) < new Date();

                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/purchases/expenses/${p.id}`}
                        style={{ color: 'var(--color-primary)', fontWeight: 600 }}
                      >
                        {p.document_number}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                        {p.supplier?.name || 'Proveedor General'}
                      </div>
                      <div className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {p.supplier?.tax_id}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(p.document_date)}
                    </td>
                    <td style={{ fontSize: '12px', color: isOverdue ? '#f87171' : 'var(--text-muted)' }}>
                      {formatDate(p.due_date)} {isOverdue && '(!)'}
                    </td>
                    <td className="num-mono" style={{ fontSize: '13px' }}>
                      {formatCurrency(p.subtotal)}
                    </td>
                    <td className="num-mono" style={{ fontSize: '13px', color: '#c084fc' }}>
                      {formatCurrency(p.deductible_tax_total)}
                    </td>
                    <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                      {formatCurrency(p.total)}
                    </td>
                    <td
                      className="num-mono"
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: p.balance_due > 0 && p.status !== 'void' ? '#f87171' : 'var(--text-dim)',
                      }}
                    >
                      {formatCurrency(p.status === 'void' ? 0 : p.balance_due)}
                    </td>
                    <td>
                      <Badge status={p.status} />
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
