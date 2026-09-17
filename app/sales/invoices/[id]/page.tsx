'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  FileText,
  AlertTriangle,
  Download,
  Calendar,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  INITIAL_INVOICES,
  INITIAL_CUSTOMERS,
  INITIAL_PAYMENTS,
  INITIAL_DOCUMENTS,
} from '@/lib/supabase/mock-store';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const invoice = INITIAL_INVOICES.find((i) => i.id === invoiceId) || INITIAL_INVOICES[0];
  const customer = INITIAL_CUSTOMERS.find((c) => c.id === invoice.customer_id);

  // Find payments allocated to this invoice
  const relatedPayments = INITIAL_PAYMENTS.filter((p) =>
    p.allocations.some((a) => a.document_id === invoice.id)
  );

  // Find attached documents
  const attachedDocs = INITIAL_DOCUMENTS.filter(
    (d) => d.entity_type === 'sales_invoice' && d.entity_id === invoice.id
  );

  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [status, setStatus] = useState(invoice.status);

  const handleVoidInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('void');
    invoice.status = 'void';
    setIsVoidModalOpen(false);
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Top action bar */}
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
          <ArrowLeft size={18} /> Volver a Facturas
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {status !== 'void' && (
            <Button
              variant="outline-danger"
              onClick={() => setIsVoidModalOpen(true)}
            >
              Anular Factura
            </Button>
          )}
          {status !== 'paid' && status !== 'void' && (
            <Link href={`/sales/payments?invoiceId=${invoice.id}`}>
              <Button variant="primary" icon={<CreditCard size={16} />}>
                Registrar Cobro
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Invoice Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
                {invoice.invoice_number}
              </h1>
              <Badge status={status} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
              Moneda: {invoice.currency_code} | Paguro Corp S.A.S. (NIT: 901.458.120-1)
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Saldo Pendiente
            </div>
            <div className="num-mono" style={{ fontSize: '22px', fontWeight: 700, color: invoice.balance_due > 0 ? '#fbbf24' : 'var(--color-success)' }}>
              {formatCurrency(status === 'void' ? 0 : invoice.balance_due)}
            </div>
          </div>
        </div>

        {/* Customer & Dates Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Facturado A
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
              {customer?.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              NIT: {customer?.tax_id}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              {customer?.billing_address || customer?.city}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Fechas de Control
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de Emisión:</span>
              <span>{formatDate(invoice.issue_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de Vencimiento:</span>
              <span style={{ fontWeight: 600 }}>{formatDate(invoice.due_date)}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="table-container" style={{ marginBottom: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Precio Unit.</th>
                <th>IVA</th>
                <th>Total Línea</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>{item.description}</div>
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {item.quantity}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {(item.tax_rate * 100).toFixed(0)}%
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ width: '320px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
              <span className="num-mono">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>IVA Total (19%):</span>
              <span className="num-mono">{formatCurrency(invoice.tax_total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginBottom: '6px' }}>
              <span>Total Factura:</span>
              <span className="num-mono">{formatCurrency(invoice.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-success)', marginBottom: '4px' }}>
              <span>Total Pagado:</span>
              <span className="num-mono">-{formatCurrency(invoice.paid_total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: invoice.balance_due > 0 ? '#fbbf24' : 'var(--text-dim)' }}>
              <span>Saldo Pendiente:</span>
              <span className="num-mono">{formatCurrency(invoice.balance_due)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Notas:</strong> {invoice.notes}
          </div>
        )}
      </div>

      {/* Payment History Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
          Historial de Cobros Aplicados
        </h2>

        {relatedPayments.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '16px' }}>
            No se han registrado pagos aún para esta factura.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Monto Asignado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {relatedPayments.map((p) => {
                  const alloc = p.allocations.find((a) => a.document_id === invoice.id);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontSize: '12px' }}>{formatDate(p.payment_date)}</td>
                      <td style={{ fontSize: '12px' }}>{p.method}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{p.reference}</td>
                      <td className="num-mono" style={{ fontWeight: 600, color: '#34d399' }}>
                        {formatCurrency(alloc?.amount || 0)}
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

      {/* Documents Attached */}
      {attachedDocs.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '14px' }}>
            Documentos & Soportes Adjuntos
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attachedDocs.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={18} color="var(--color-primary)" />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-white)' }}>
                      {doc.file_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {(doc.file_size_bytes / 1024).toFixed(0)} KB | Version {doc.version}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="secondary" icon={<Download size={14} />}>
                  Descargar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Void Invoice Confirmation */}
      <Modal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        title="Confirmar Anulación de Factura"
      >
        <form onSubmit={handleVoidInvoice}>
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <strong>Advertencia:</strong> Anular esta factura la excluirá de los reportes de ventas e ingresos y del cálculo de IVA generado. Esta acción quedará registrada de forma inmutable en la bitácora de auditoría.
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de Anulación *</label>
            <textarea
              required
              rows={3}
              className="form-textarea"
              placeholder="Explique la razón de la anulación (ej. error en precios, devolución comercial)..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsVoidModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit">
              Confirmar Anulación
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
