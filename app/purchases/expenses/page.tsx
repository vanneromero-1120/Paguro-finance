'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { INITIAL_PURCHASES, INITIAL_SUPPLIERS } from '@/lib/supabase/mock-store';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function ExpensesPage() {
  const [purchases, setPurchases] = useState(INITIAL_PURCHASES);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filteredPurchases = purchases.filter((p) => {
    const supplier = INITIAL_SUPPLIERS.find((s) => s.id === p.supplier_id);
    const matchesSearch =
      p.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (categoryFilter === 'all') return true;
    return p.category === categoryFilter;
  });

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
        <Link href="/purchases/expenses/new">
          <Button variant="primary" icon={<Plus size={16} />}>
            Registrar Gasto / Compra
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
            placeholder="Buscar por soporte, proveedor o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'OPERATING', 'LOGISTICS', 'MARKETING', 'INVENTORY'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: categoryFilter === cat ? 600 : 400,
                backgroundColor: categoryFilter === cat ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: categoryFilter === cat ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {cat === 'all' ? 'Todas las Categorías' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
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
            {filteredPurchases.map((p) => {
              const supplier = INITIAL_SUPPLIERS.find((s) => s.id === p.supplier_id);
              return (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {p.document_number}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {supplier?.name || 'Proveedor General'}
                    </div>
                    <div className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {supplier?.tax_id}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                      {p.category}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(p.document_date)}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(p.due_date)}
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
                      color: p.balance_due > 0 ? '#f87171' : 'var(--text-dim)',
                    }}
                  >
                    {formatCurrency(p.balance_due)}
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
    </div>
  );
}
