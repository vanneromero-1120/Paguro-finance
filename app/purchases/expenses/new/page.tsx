'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { INITIAL_SUPPLIERS, INITIAL_PURCHASES } from '@/lib/supabase/mock-store';
import { calculateLineItem, calculateDocumentTotals } from '@/lib/finance/calculations';
import { formatCurrency } from '@/lib/utils/formatters';

export default function NewExpensePage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(INITIAL_SUPPLIERS[0]?.id || '');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [category, setCategory] = useState('OPERATING');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState([
    {
      description: 'Gasto operativo o compra de insumos',
      quantity: 1,
      unitPrice: 100000,
      taxRate: 0.19,
    },
  ]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0.19,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculatedItems = lines.map((l) =>
    calculateLineItem({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })
  );
  const totals = calculateDocumentTotals(calculatedItems, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber) return;

    const newPurchase = {
      id: `pur-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      document_number: documentNumber,
      supplier_id: supplierId,
      document_date: documentDate,
      due_date: dueDate,
      category,
      currency_code: 'COP',
      subtotal: totals.subtotal,
      deductible_tax_total: totals.taxTotal,
      retention_total: 0,
      total: totals.total,
      paid_total: 0,
      balance_due: totals.total,
      status: 'open' as const,
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: lines.map((l, idx) => ({
        id: `pitem-${Date.now()}-${idx}`,
        purchase_document_id: `pur-${Date.now()}`,
        product_id: null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        tax_rate_id: null,
        tax_rate: l.taxRate,
        tax_amount: calculatedItems[idx].taxAmount,
        line_total: calculatedItems[idx].lineTotal,
        created_at: new Date().toISOString(),
      })),
    };

    INITIAL_PURCHASES.unshift(newPurchase);
    router.push('/purchases/expenses');
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} /> Volver a Gastos
        </button>

        <Button variant="primary" icon={<Save size={16} />} onClick={handleSubmit}>
          Guardar Gasto
        </Button>
      </div>

      <div className="card">
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '16px' }}>
          Registrar Gasto o Compra
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Proveedor Emisor *</label>
              <select
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {INITIAL_SUPPLIERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (NIT: {s.tax_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Número de Factura / Soporte *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ej. INV-88391"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Categoría Operativa</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="OPERATING">Gastos Operativos</option>
                <option value="LOGISTICS">Logística & Despachos</option>
                <option value="MARKETING">Publicidad & Marketing</option>
                <option value="INVENTORY">Compras de Inventario</option>
                <option value="SERVICES">Servicios & Asesorías</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Fecha del Documento *</label>
              <input
                type="date"
                className="form-input"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Vencimiento de Pago</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Line items */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
              Conceptos del Gasto
            </div>

            <div className="table-container" style={{ marginBottom: '12px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '45%' }}>Descripción del Concepto</th>
                    <th style={{ width: '10%' }}>Cant.</th>
                    <th style={{ width: '20%' }}>Precio Unitario</th>
                    <th style={{ width: '10%' }}>IVA</th>
                    <th style={{ width: '10%' }}>Total</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const calc = calculatedItems[idx];
                    return (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            required
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            value={line.description}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx].description = e.target.value;
                              setLines(updated);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            className="form-input num-mono"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            value={line.quantity}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx].quantity = Math.max(1, Number(e.target.value));
                              setLines(updated);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="form-input num-mono"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            value={line.unitPrice}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx].unitPrice = Number(e.target.value);
                              setLines(updated);
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            value={line.taxRate}
                            onChange={(e) => {
                              const updated = [...lines];
                              updated[idx].taxRate = Number(e.target.value);
                              setLines(updated);
                            }}
                          >
                            <option value={0.19}>19%</option>
                            <option value={0.05}>5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="num-mono" style={{ fontWeight: 600 }}>
                          {formatCurrency(calc.lineTotal)}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={handleAddLine}>
              Agregar Concepto
            </Button>
          </div>

          {/* Totals Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
            <div className="form-group">
              <label className="form-label">Notas Adicionales</label>
              <textarea
                rows={3}
                className="form-textarea"
                placeholder="Observaciones de pago, cuenta bancaria, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span className="num-mono">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>IVA Descontable:</span>
                <span className="num-mono" style={{ color: '#c084fc' }}>{formatCurrency(totals.taxTotal)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-white)',
                }}
              >
                <span>Total Gasto:</span>
                <span className="num-mono" style={{ color: '#f87171' }}>
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
