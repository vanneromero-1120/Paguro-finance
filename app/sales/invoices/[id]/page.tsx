'use client';

// ============================================================================
// Paguro Finance - Sales Invoice Detail View
// Real Supabase data, Real-time status sync, Void & Payment integration
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  AlertTriangle,
  Calendar,
  Building,
  RefreshCw,
  AlertCircle,
  Send,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { InvoiceWithDetails } from '@/types/database';
import {
  getSalesInvoiceByIdAction,
  issueSalesInvoiceAction,
  voidSalesInvoiceAction,
} from '@/lib/actions/invoices';
import { recordCustomerPaymentAction } from '@/lib/actions/payments';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User authorization
  const [userRole, setUserRole] = useState<string | null>(null);
  const canWrite = userRole ? WRITE_ROLES.includes(userRole) : false;
  const canVoid = userRole ? VOID_ROLES.includes(userRole) : false;

  // Modals
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

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

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getSalesInvoiceByIdAction(invoiceId);
      if (res.success && res.data) {
        setInvoice(res.data);
        setPaymentAmount(Number(res.data.balance_due));
      } else {
        setErrorMsg(res.error || 'No se pudo cargar la factura.');
      }
    } catch (err: any) {
      console.error('[InvoiceDetailPage] Error loading:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar la factura.');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleIssueInvoice = async () => {
    if (!invoice) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await issueSalesInvoiceAction(invoice.id);
      if (res.success) {
        setSuccessMsg(res.message || 'Factura emitida correctamente.');
        await loadInvoice();
      } else {
        setErrorMsg(res.error || 'Error al emitir la factura.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al emitir factura.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await voidSalesInvoiceAction(invoice.id, voidReason);
      if (res.success) {
        setSuccessMsg(res.message || 'Factura anulada con éxito.');
        setIsVoidModalOpen(false);
        setVoidReason('');
        await loadInvoice();
      } else {
        setErrorMsg(res.error || 'Error al anular la factura.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al anular factura.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await recordCustomerPaymentAction({
        invoice_id: invoice.id,
        amount: Number(paymentAmount),
        payment_date: paymentDate,
        method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Cobro registrado exitosamente.');
        setIsPaymentModalOpen(false);
        setPaymentReference('');
        setPaymentNotes('');
        await loadInvoice();
      } else {
        setErrorMsg(res.error || 'Error al registrar el cobro.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al registrar el cobro.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
        <div style={{ color: 'var(--text-muted)' }}>Cargando detalle de la factura...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ maxWidth: '960px', margin: '40px auto', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--color-danger)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '18px', color: 'var(--text-white)', marginBottom: '8px' }}>
          Factura no encontrada
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {errorMsg || 'La factura solicitada no existe o no tiene permisos para visualizarla.'}
        </p>
        <Link href="/sales/invoices">
          <Button variant="secondary" icon={<ArrowLeft size={16} />}>
            Volver al listado
          </Button>
        </Link>
      </div>
    );
  }

  const isOverdue = invoice.balance_due > 0 && invoice.status !== 'void' && new Date(invoice.due_date) < new Date();

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
          {invoice.status === 'draft' && canWrite && (
            <Button
              variant="primary"
              disabled={actionLoading}
              icon={<Send size={16} />}
              onClick={handleIssueInvoice}
            >
              {actionLoading ? 'Emitiendo...' : 'Emitir Factura'}
            </Button>
          )}

          {invoice.status !== 'void' && canVoid && (
            <Button
              variant="outline-danger"
              disabled={actionLoading}
              onClick={() => setIsVoidModalOpen(true)}
            >
              Anular Factura
            </Button>
          )}

          {invoice.status !== 'paid' && invoice.status !== 'void' && canWrite && (
            <Button
              variant="primary"
              icon={<CreditCard size={16} />}
              onClick={() => {
                setPaymentAmount(Number(invoice.balance_due));
                setIsPaymentModalOpen(true);
              }}
            >
              Registrar Cobro
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
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

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--color-success)',
            color: 'var(--color-success)',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Invoice Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '20px',
            marginBottom: '20px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
                {invoice.invoice_number}
              </h1>
              <Badge status={invoice.status} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
              Moneda: {invoice.currency_code} | Registrada en Supabase
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Saldo Pendiente
            </div>
            <div
              className="num-mono"
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color:
                  invoice.status === 'void'
                    ? 'var(--text-dim)'
                    : invoice.balance_due > 0
                    ? '#fbbf24'
                    : 'var(--color-success)',
              }}
            >
              {formatCurrency(invoice.status === 'void' ? 0 : invoice.balance_due)}
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
              {invoice.customer?.name || 'Cliente sin nombre'}
            </div>
            {invoice.customer?.tax_id && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                NIT / Identificación: {invoice.customer.tax_id}
              </div>
            )}
            {invoice.customer?.email && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Email: {invoice.customer.email}
              </div>
            )}
            {invoice.customer?.billing_address && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Dirección: {invoice.customer.billing_address}, {invoice.customer.city}
              </div>
            )}
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
              <span style={{ fontWeight: 600, color: isOverdue ? '#f87171' : 'inherit' }}>
                {formatDate(invoice.due_date)} {isOverdue && '(! Vencida)'}
              </span>
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
                <th>IVA / Impuesto</th>
                <th>Monto IVA</th>
                <th>Total Línea</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-white)' }}>{item.description}</div>
                    {item.product && (
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        SKU: {item.product.sku} ({item.product.product_type === 'physical' ? 'Físico' : 'Servicio'})
                      </div>
                    )}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {item.quantity}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px' }}>
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {item.tax_rate_obj ? `${item.tax_rate_obj.name} (${(Number(item.tax_rate) * 100).toFixed(0)}%)` : `${(Number(item.tax_rate) * 100).toFixed(0)}%`}
                  </td>
                  <td className="num-mono" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {formatCurrency(item.tax_amount)}
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
              <span style={{ color: 'var(--text-muted)' }}>IVA Total:</span>
              <span className="num-mono">{formatCurrency(invoice.tax_total)}</span>
            </div>
            {invoice.discount_total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-danger)', marginBottom: '6px' }}>
                <span>Descuento:</span>
                <span className="num-mono">-{formatCurrency(invoice.discount_total)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-white)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '8px',
                marginBottom: '6px',
              }}
            >
              <span>Total Factura:</span>
              <span className="num-mono">{formatCurrency(invoice.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-success)', marginBottom: '4px' }}>
              <span>Total Pagado:</span>
              <span className="num-mono">-{formatCurrency(invoice.paid_total)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 700,
                color: invoice.balance_due > 0 && invoice.status !== 'void' ? '#fbbf24' : 'var(--text-dim)',
              }}
            >
              <span>Saldo Pendiente:</span>
              <span className="num-mono">{formatCurrency(invoice.status === 'void' ? 0 : invoice.balance_due)}</span>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)' }}>
            Historial de Cobros Aplicados
          </h2>
          {invoice.status !== 'paid' && invoice.status !== 'void' && canWrite && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CreditCard size={14} />}
              onClick={() => {
                setPaymentAmount(Number(invoice.balance_due));
                setIsPaymentModalOpen(true);
              }}
            >
              Nuevo Abono
            </Button>
          )}
        </div>

        {!invoice.payments || invoice.payments.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
            No se han registrado cobros aún para esta factura.
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
                {invoice.payments.map((alloc) => {
                  const pay = alloc.payment;
                  return (
                    <tr key={alloc.id}>
                      <td style={{ fontSize: '12px' }}>{pay ? formatDate(pay.payment_date) : '-'}</td>
                      <td style={{ fontSize: '12px' }}>{pay?.method || 'N/A'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{pay?.reference || '-'}</td>
                      <td className="num-mono" style={{ fontWeight: 600, color: '#34d399' }}>
                        {formatCurrency(alloc.amount)}
                      </td>
                      <td>
                        <Badge status={pay?.status || 'completed'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Register Payment */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Registrar Cobro - Factura ${invoice.invoice_number}`}
      >
        <form onSubmit={handleRegisterPayment}>
          <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Saldo actual de la factura:{' '}
            <strong style={{ color: '#fbbf24' }}>{formatCurrency(invoice.balance_due)}</strong>
          </div>

          <div className="form-group">
            <label className="form-label">Monto a Cobrar ($ COP) *</label>
            <input
              type="number"
              required
              min="0.01"
              max={Number(invoice.balance_due)}
              step="any"
              className="form-input num-mono"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              El monto no puede exceder el saldo pendiente (${Number(invoice.balance_due).toLocaleString()}).
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Fecha del Cobro *</label>
              <input
                type="date"
                required
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Método de Pago *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta de Débito / Crédito</option>
                <option value="CHECK">Cheque</option>
                <option value="PSE">PSE / Pasarela Virtual</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Referencia / Comprobante</label>
            <input
              type="text"
              className="form-input"
              placeholder="Número de aprobación, comprobante bancario..."
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notas Adicionales</label>
            <textarea
              rows={2}
              className="form-textarea"
              placeholder="Detalles sobre el cobro o cuenta destino..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={actionLoading}>
              {actionLoading ? 'Registrando...' : 'Confirmar Cobro'}
            </Button>
          </div>
        </form>
      </Modal>

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
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            <strong>Advertencia de Integridad Financiera:</strong> Anular esta factura revertirá cualquier salida de inventario físico relacionada y fijará el saldo a cero. Las facturas con pagos activos no pueden anularse. Esta operación queda registrada en la bitácora de auditoría inmutable.
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de Anulación *</label>
            <textarea
              required
              rows={3}
              className="form-textarea"
              placeholder="Explique la razón de la anulación (ej. error en precios, anulación formal a solicitud del cliente)..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsVoidModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="danger" type="submit" disabled={actionLoading}>
              {actionLoading ? 'Anulando...' : 'Confirmar Anulación'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
