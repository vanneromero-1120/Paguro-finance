'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_TAX_RATES,
  INITIAL_INVOICES,
} from '@/lib/supabase/mock-store';
import { calculateLineItem, calculateDocumentTotals } from '@/lib/finance/calculations';
import { formatCurrency } from '@/lib/utils/formatters';

interface DraftLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRateId: string;
  taxRate: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(INITIAL_CUSTOMERS[0]?.id || '');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<DraftLine[]>([
    {
      productId: INITIAL_PRODUCTS[0]?.id || '',
      description: INITIAL_PRODUCTS[0]?.name || '',
      quantity: 1,
      unitPrice: INITIAL_PRODUCTS[0]?.sale_price || 0,
      discountAmount: 0,
      taxRateId: INITIAL_TAX_RATES[0]?.id || '',
      taxRate: INITIAL_TAX_RATES[0]?.rate || 0.19,
    },
  ]);

  const handleProductChange = (index: number, prodId: string) => {
    const product = INITIAL_PRODUCTS.find((p) => p.id === prodId);
    if (!product) return;

    const tax = INITIAL_TAX_RATES.find((t) => t.id === product.tax_rate_id);
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      productId: prodId,
      description: product.name,
      unitPrice: product.sale_price,
      taxRateId: product.tax_rate_id,
      taxRate: tax?.rate || 0.19,
    };
    setLines(updated);
  };

  const handleAddLine = () => {
    const defaultProduct = INITIAL_PRODUCTS[0];
    const tax = INITIAL_TAX_RATES.find((t) => t.id === defaultProduct?.tax_rate_id);
    setLines([
      ...lines,
      {
        productId: defaultProduct?.id || '',
        description: defaultProduct?.name || '',
        quantity: 1,
        unitPrice: defaultProduct?.sale_price || 0,
        discountAmount: 0,
        taxRateId: defaultProduct?.tax_rate_id || '',
        taxRate: tax?.rate || 0.19,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Real-time calculated totals
  const calculatedItems = lines.map((l) =>
    calculateLineItem({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      taxRate: l.taxRate,
    })
  );
  const totals = calculateDocumentTotals(calculatedItems, 0);

  const handleSubmit = (status: 'draft' | 'issued') => {
    const newInvoiceNumber = `FAC-2026-0000${INITIAL_INVOICES.length + 1}`;
    const newInvoice = {
      id: `inv-${Date.now()}`,
      company_id: 'c1111111-1111-1111-1111-111111111111',
      invoice_number: newInvoiceNumber,
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      currency_code: 'COP',
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      discount_total: totals.discountTotal,
      total: totals.total,
      paid_total: 0,
      balance_due: totals.total,
      status: status,
      notes: notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: lines.map((l, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        invoice_id: `inv-${Date.now()}`,
        product_id: l.productId,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        discount_amount: l.discountAmount,
        tax_rate_id: l.taxRateId,
        tax_rate: l.taxRate,
        tax_amount: calculatedItems[idx].taxAmount,
        line_total: calculatedItems[idx].lineTotal,
        created_at: new Date().toISOString(),
      })),
    };

    INITIAL_INVOICES.unshift(newInvoice);
    router.push('/sales/invoices');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top action header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
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
          <ArrowLeft size={18} /> Volver a Facturas
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" icon={<Save size={16} />} onClick={() => handleSubmit('draft')}>
            Guardar Borrador
          </Button>
          <Button variant="primary" icon={<Send size={16} />} onClick={() => handleSubmit('issued')}>
            Emitir Factura
          </Button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '16px' }}>
          Nueva Factura de Venta
        </h1>

        {/* Customer and Dates row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group">
            <label className="form-label">Cliente Receptor *</label>
            <select
              className="form-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {INITIAL_CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (NIT: {c.tax_id})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Emisión *</label>
            <input
              type="date"
              className="form-input"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha de Vencimiento *</label>
            <input
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Invoice Lines Table */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
            Líneas de la Factura
          </div>

          <div className="table-container" style={{ marginBottom: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Producto</th>
                  <th style={{ width: '30%' }}>Descripción</th>
                  <th style={{ width: '10%' }}>Cant.</th>
                  <th style={{ width: '15%' }}>Precio Unit.</th>
                  <th style={{ width: '10%' }}>IVA</th>
                  <th style={{ width: '15%' }}>Total Línea</th>
                  <th style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const calc = calculatedItems[idx];
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          className="form-select"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={line.productId}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                        >
                          {INITIAL_PRODUCTS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
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
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {(line.taxRate * 100).toFixed(0)}%
                      </td>
                      <td className="num-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(calc.lineTotal)}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            display: 'flex',
                          }}
                          title="Eliminar línea"
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
            Agregar Línea
          </Button>
        </div>

        {/* Totals Summary and Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
          <div className="form-group">
            <label className="form-label">Observaciones o Términos Comerciales</label>
            <textarea
              rows={4}
              className="form-textarea"
              placeholder="Detalles de entrega, consignación bancaria, etc."
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
              <span style={{ color: 'var(--text-muted)' }}>IVA Total (19%):</span>
              <span className="num-mono">{formatCurrency(totals.taxTotal)}</span>
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
              <span>Total Factura:</span>
              <span className="num-mono" style={{ color: 'var(--color-primary)' }}>
                {formatCurrency(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
