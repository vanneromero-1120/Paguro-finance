'use client';

// ============================================================================
// Paguro Finance - Create Sales Invoice
// Real Supabase data, Dynamic Tax Rates, Stock Awareness, Zero mock-store
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, ArrowLeft, Save, Send, AlertCircle, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Customer, ProductWithStock, TaxRate } from '@/types/database';
import { getCustomersAction } from '@/lib/actions/customers';
import { getProductsAction } from '@/lib/actions/products';
import { createSalesInvoiceAction } from '@/lib/actions/invoices';
import { createClient } from '@/lib/supabase/client';
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

  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadMasterData() {
      setLoadingData(true);
      setErrorMsg(null);
      try {
        const [custRes, prodRes] = await Promise.all([
          getCustomersAction(),
          getProductsAction(),
        ]);

        const supabase = createClient();
        let loadedTaxRates: TaxRate[] = [];
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: compUser } = await supabase
              .from('company_users')
              .select('company_id')
              .eq('user_id', user.id)
              .in('status', ['active', 'ACTIVE'])
              .single();
            if (compUser) {
              const { data: trData } = await supabase
                .from('tax_rates')
                .select('*')
                .eq('company_id', compUser.company_id)
                .order('rate', { ascending: false });
              loadedTaxRates = (trData as TaxRate[]) || [];
            }
          }
        }

        const loadedCusts = custRes.success && custRes.data ? custRes.data : [];
        const loadedProds = prodRes.success && prodRes.data ? prodRes.data : [];

        setCustomers(loadedCusts);
        setProducts(loadedProds);
        setTaxRates(loadedTaxRates);

        if (loadedCusts.length > 0) {
          setCustomerId(loadedCusts[0].id);
        }

        // Initialize first line
        const defaultTax = loadedTaxRates.find((t) => t.code === 'IVA_19') || loadedTaxRates[0];
        const defaultProd = loadedProds[0];

        setLines([
          {
            productId: defaultProd ? defaultProd.id : '',
            description: defaultProd ? defaultProd.name : 'Servicio o ítem comercial',
            quantity: 1,
            unitPrice: defaultProd ? Number(defaultProd.sale_price) : 0,
            discountAmount: 0,
            taxRateId: defaultTax ? defaultTax.id : '',
            taxRate: defaultTax ? Number(defaultTax.rate) : 0.19,
          },
        ]);
      } catch (err: any) {
        console.error('[NewInvoicePage] Error loading master data:', err);
        setErrorMsg('Error al cargar datos maestros de clientes, productos e impuestos.');
      } finally {
        setLoadingData(false);
      }
    }

    loadMasterData();
  }, []);

  const handleProductChange = (index: number, prodId: string) => {
    if (!prodId) {
      const updated = [...lines];
      updated[index] = {
        ...updated[index],
        productId: '',
      };
      setLines(updated);
      return;
    }

    const product = products.find((p) => p.id === prodId);
    if (!product) return;

    const tax = taxRates.find((t) => t.id === product.tax_rate_id) || taxRates[0];
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      productId: prodId,
      description: product.name,
      unitPrice: Number(product.sale_price || 0),
      taxRateId: tax ? tax.id : '',
      taxRate: tax ? Number(tax.rate) : 0.19,
    };
    setLines(updated);
  };

  const handleTaxRateChange = (index: number, taxRateId: string) => {
    const tax = taxRates.find((t) => t.id === taxRateId);
    if (!tax) return;

    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      taxRateId: tax.id,
      taxRate: Number(tax.rate),
    };
    setLines(updated);
  };

  const handleAddLine = () => {
    const defaultTax = taxRates.find((t) => t.code === 'IVA_19') || taxRates[0];
    const defaultProd = products[0];

    setLines([
      ...lines,
      {
        productId: defaultProd ? defaultProd.id : '',
        description: defaultProd ? defaultProd.name : '',
        quantity: 1,
        unitPrice: defaultProd ? Number(defaultProd.sale_price) : 0,
        discountAmount: 0,
        taxRateId: defaultTax ? defaultTax.id : '',
        taxRate: defaultTax ? Number(defaultTax.rate) : 0.19,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Real-time calculated totals for preview
  const calculatedItems = lines.map((l) =>
    calculateLineItem({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      taxRate: l.taxRate,
    })
  );
  const totals = calculateDocumentTotals(calculatedItems, 0);

  const handleSubmit = async (status: 'draft' | 'issued') => {
    setErrorMsg(null);

    if (!customerId) {
      setErrorMsg('Debe seleccionar o registrar un cliente antes de emitir la factura.');
      return;
    }

    if (lines.length === 0) {
      setErrorMsg('Debe agregar al menos una línea de producto o servicio.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.description.trim()) {
        setErrorMsg(`La línea #${i + 1} debe contener una descripción válida.`);
        return;
      }
      if (line.quantity <= 0) {
        setErrorMsg(`La cantidad en la línea #${i + 1} debe ser mayor a 0.`);
        return;
      }
      if (line.unitPrice < 0) {
        setErrorMsg(`El precio unitario en la línea #${i + 1} no puede ser negativo.`);
        return;
      }
      if (!line.taxRateId) {
        setErrorMsg(`Debe seleccionar una tasa de IVA válida en la línea #${i + 1}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await createSalesInvoiceAction({
        customer_id: customerId,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim() || null,
        status: status,
        items: lines.map((l) => ({
          product_id: l.productId || null,
          description: l.description.trim(),
          quantity: l.quantity,
          unit_price: l.unitPrice,
          discount_amount: l.discountAmount,
          tax_rate_id: l.taxRateId,
        })),
      });

      if (res.success && res.data) {
        router.push('/sales/invoices');
      } else {
        setErrorMsg(res.error || 'Error al procesar la factura.');
      }
    } catch (err: any) {
      console.error('[NewInvoicePage] Submission exception:', err);
      setErrorMsg(err?.message || 'Error inesperado al guardar la factura.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center', padding: '60px 0' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
        <div style={{ color: 'var(--text-muted)' }}>Cargando catálogo maestro...</div>
      </div>
    );
  }

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
          <Button
            variant="secondary"
            icon={<Save size={16} />}
            disabled={submitting}
            onClick={() => handleSubmit('draft')}
          >
            {submitting ? 'Guardando...' : 'Guardar Borrador'}
          </Button>
          <Button
            variant="primary"
            icon={<Send size={16} />}
            disabled={submitting}
            onClick={() => handleSubmit('issued')}
          >
            {submitting ? 'Emitiendo...' : 'Emitir Factura'}
          </Button>
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
            marginBottom: '20px',
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

      {/* Empty customer warning */}
      {customers.length === 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            color: '#fbbf24',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} />
            <span>No tiene clientes registrados en la empresa para asociar a la factura.</span>
          </div>
          <Link href="/sales/customers">
            <Button variant="secondary" size="sm" icon={<Users size={14} />}>
              Registrar Cliente
            </Button>
          </Link>
        </div>
      )}

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
              {customers.length === 0 && <option value="">Sin clientes registrados</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.tax_id ? `(NIT: ${c.tax_id})` : ''}
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
                  <th style={{ width: '25%' }}>Producto (Catálogo)</th>
                  <th style={{ width: '30%' }}>Descripción *</th>
                  <th style={{ width: '10%' }}>Cant. *</th>
                  <th style={{ width: '13%' }}>Precio Unit. *</th>
                  <th style={{ width: '12%' }}>Impuesto / IVA</th>
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
                          <option value="">-- Ítem personalizado --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name} ({p.product_type === 'physical' ? `Stock: ${p.current_stock}` : 'Servicio'})
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
                          placeholder="Descripción del ítem"
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
                          min="0.01"
                          step="any"
                          className="form-input num-mono"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[idx].quantity = Math.max(0, Number(e.target.value));
                            setLines(updated);
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="form-input num-mono"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={line.unitPrice}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[idx].unitPrice = Math.max(0, Number(e.target.value));
                            setLines(updated);
                          }}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          value={line.taxRateId}
                          onChange={(e) => handleTaxRateChange(idx, e.target.value)}
                        >
                          {taxRates.map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.name} ({(Number(tr.rate) * 100).toFixed(0)}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num-mono" style={{ fontWeight: 600 }}>
                        {formatCurrency(calc.lineTotal)}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length <= 1}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: lines.length <= 1 ? 'var(--text-dim)' : '#f87171',
                            cursor: lines.length <= 1 ? 'not-allowed' : 'pointer',
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
              <span style={{ color: 'var(--text-muted)' }}>IVA Total:</span>
              <span className="num-mono">{formatCurrency(totals.taxTotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Descuento:</span>
                <span className="num-mono" style={{ color: 'var(--color-danger)' }}>
                  -{formatCurrency(totals.discountTotal)}
                </span>
              </div>
            )}
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
