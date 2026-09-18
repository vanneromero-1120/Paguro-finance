'use client';

// ============================================================================
// Paguro Finance - Create Purchase Document / Operational Expense
// Real Supabase data, Dynamic Tax Rates, Multi-company isolated, Zero mock-store
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Send, Plus, Trash2, AlertCircle, RefreshCw, Truck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Supplier, ProductWithStock, TaxRate } from '@/types/database';
import { getSuppliersAction } from '@/lib/actions/suppliers';
import { getProductsAction } from '@/lib/actions/products';
import { createPurchaseDocumentAction } from '@/lib/actions/purchases';
import { createClient } from '@/lib/supabase/client';
import { calculateLineItem, calculateDocumentTotals, roundHalfUp } from '@/lib/finance/calculations';
import { formatCurrency } from '@/lib/utils/formatters';

interface DraftPurchaseLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId: string;
  taxRate: number;
}

export default function NewExpensePage() {
  const router = useRouter();

  // Data state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [category, setCategory] = useState('Gastos Operativos');
  const [retentionAmount, setRetentionAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftPurchaseLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadMasterData() {
      setLoadingData(true);
      setErrorMsg(null);
      try {
        const [suppRes, prodRes] = await Promise.all([
          getSuppliersAction(),
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

        const loadedSupps = suppRes.success && suppRes.data ? suppRes.data : [];
        const loadedProds = prodRes.success && prodRes.data ? prodRes.data : [];

        setSuppliers(loadedSupps);
        setProducts(loadedProds);
        setTaxRates(loadedTaxRates);

        if (loadedSupps.length > 0) {
          setSupplierId(loadedSupps[0].id);
        }

        // Initialize first line
        const defaultTax = loadedTaxRates.find((t) => t.code === 'IVA_19') || loadedTaxRates[0];
        setLines([
          {
            productId: '',
            description: 'Gasto operativo o compra de insumos',
            quantity: 1,
            unitPrice: 0,
            taxRateId: defaultTax ? defaultTax.id : '',
            taxRate: defaultTax ? Number(defaultTax.rate) : 0.19,
          },
        ]);
      } catch (err: any) {
        console.error('[NewExpensePage] Error loading master data:', err);
        setErrorMsg('Error al cargar datos maestros de proveedores e impuestos.');
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
      unitPrice: Number(product.cost || 0),
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
    setLines([
      ...lines,
      {
        productId: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRateId: defaultTax ? defaultTax.id : '',
        taxRate: defaultTax ? Number(defaultTax.rate) : 0.19,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  // Preview calculations
  const calculatedItems = lines.map((l) =>
    calculateLineItem({
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
    })
  );
  const baseTotals = calculateDocumentTotals(calculatedItems, 0);
  const finalTotal = Math.max(0, roundHalfUp(baseTotals.total - Number(retentionAmount || 0), 2));

  const handleSubmit = async (status: 'draft' | 'open') => {
    setErrorMsg(null);

    if (!documentNumber.trim()) {
      setErrorMsg('Debe ingresar el número de factura o documento de soporte del proveedor.');
      return;
    }

    if (!supplierId) {
      setErrorMsg('Debe seleccionar o registrar un proveedor.');
      return;
    }

    if (lines.length === 0) {
      setErrorMsg('Debe incluir al menos un concepto de gasto o compra.');
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
        setErrorMsg(`El costo unitario en la línea #${i + 1} no puede ser negativo.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await createPurchaseDocumentAction({
        document_number: documentNumber.trim(),
        supplier_id: supplierId,
        document_date: documentDate,
        due_date: dueDate,
        category: category,
        retention_total: Number(retentionAmount || 0),
        notes: notes.trim() || null,
        status: status,
        items: lines.map((l) => ({
          product_id: l.productId || null,
          description: l.description.trim(),
          quantity: l.quantity,
          unit_price: l.unitPrice,
          tax_rate_id: l.taxRateId || null,
          tax_rate: l.taxRate,
        })),
      });

      if (res.success && res.data) {
        router.push('/purchases/expenses');
      } else {
        setErrorMsg(res.error || 'Error al guardar documento de compra.');
      }
    } catch (err: any) {
      console.error('[NewExpensePage] Submission exception:', err);
      setErrorMsg(err?.message || 'Error inesperado al guardar compra.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center', padding: '60px 0' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
        <div style={{ color: 'var(--text-muted)' }}>Cargando datos maestros...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top action header */}
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
            onClick={() => handleSubmit('open')}
          >
            {submitting ? 'Procesando...' : 'Aprobar y Radicar'}
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

      {/* Empty suppliers warning */}
      {suppliers.length === 0 && (
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
            <span>No tiene proveedores registrados en la empresa para asociar a este documento.</span>
          </div>
          <Link href="/purchases/suppliers">
            <Button variant="secondary" size="sm" icon={<Truck size={14} />}>
              Registrar Proveedor
            </Button>
          </Link>
        </div>
      )}

      <div className="card">
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '16px' }}>
          Registrar Gasto o Compra
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">Proveedor Emisor *</label>
            <select
              className="form-select"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {suppliers.length === 0 && <option value="">Sin proveedores registrados</option>}
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.tax_id ? `(NIT: ${s.tax_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">No. Factura / Soporte Proveedor *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="Ej. FAC-99482"
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
              <option value="Gastos Operativos">Gastos Operativos</option>
              <option value="Logística & Despachos">Logística & Despachos</option>
              <option value="Publicidad & Marketing">Publicidad & Marketing</option>
              <option value="Compras de Inventario">Compras de Inventario</option>
              <option value="Servicios & Asesorías">Servicios & Asesorías</option>
              <option value="Tecnología & Software">Tecnología & Software</option>
              <option value="Arrendamientos & Servicios Públicos">Arrendamientos & Servicios Públicos</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
            <label className="form-label">Fecha de Vencimiento *</label>
            <input
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Retenciones en la Fuente ($ COP)</label>
            <input
              type="number"
              min="0"
              step="any"
              className="form-input num-mono"
              placeholder="0.00"
              value={retentionAmount}
              onChange={(e) => setRetentionAmount(Math.max(0, Number(e.target.value)))}
            />
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
            Conceptos del Gasto / Compra
          </div>

          <div className="table-container" style={{ marginBottom: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Producto (Inventario)</th>
                  <th style={{ width: '30%' }}>Descripción *</th>
                  <th style={{ width: '10%' }}>Cant. *</th>
                  <th style={{ width: '13%' }}>Costo Unit. *</th>
                  <th style={{ width: '12%' }}>IVA Descontable</th>
                  <th style={{ width: '15%' }}>Total</th>
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
                          <option value="">-- Concepto general / Servicio --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          required
                          className="form-input"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                          placeholder="Descripción del gasto..."
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
                          title="Eliminar concepto"
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
            <label className="form-label">Notas / Términos de Pago</label>
            <textarea
              rows={3}
              className="form-textarea"
              placeholder="Detalles de pago, cuenta bancaria para transferencia, retenciones aplicadas..."
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
              <span className="num-mono">{formatCurrency(baseTotals.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>IVA Descontable:</span>
              <span className="num-mono" style={{ color: '#c084fc' }}>{formatCurrency(baseTotals.taxTotal)}</span>
            </div>
            {retentionAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#fbbf24' }}>
                <span>Retención en la Fuente:</span>
                <span className="num-mono">-{formatCurrency(retentionAmount)}</span>
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
              <span>Total Gasto / CxP:</span>
              <span className="num-mono" style={{ color: '#f87171' }}>
                {formatCurrency(finalTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
