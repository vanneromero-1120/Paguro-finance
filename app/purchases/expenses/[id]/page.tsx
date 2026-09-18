'use client';

// ============================================================================
// Paguro Finance - Purchase Document / Expense Detail View (CxP)
// Real Supabase data, Real-time status sync, Supplier payment & Void integration
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  Building,
  RefreshCw,
  AlertCircle,
  Send,
  XCircle,
  CheckCircle2,
  Calendar,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PurchaseDocumentWithDetails } from '@/types/database';
import {
  getPurchaseDocumentByIdAction,
  openPurchaseDocumentAction,
  voidPurchaseDocumentAction,
} from '@/lib/actions/purchases';
import { recordSupplierPaymentAction } from '@/lib/actions/payments';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<PurchaseDocumentWithDetails | null>(null);
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

  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getPurchaseDocumentByIdAction(documentId);
      if (res.success && res.data) {
        setDocument(res.data);
        setPaymentAmount(Number(res.data.balance_due));
      } else {
        setErrorMsg(res.error || 'No se pudo cargar el documento de compra.');
      }
    } catch (err: any) {
      console.error('[PurchaseDetailPage] Error loading:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar el documento.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleOpenDocument = async () => {
    if (!document) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await openPurchaseDocumentAction(document.id);
      if (res.success) {
        setSuccessMsg(res.message || 'Documento aprobado y stock recibido con éxito.');
        await loadDocument();
      } else {
        setErrorMsg(res.error || 'Error al aprobar el documento.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al aprobar el documento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoidDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await voidPurchaseDocumentAction(document.id, voidReason);
      if (res.success) {
        setSuccessMsg(res.message || 'Documento anulado con éxito.');
        setIsVoidModalOpen(false);
        setVoidReason('');
        await loadDocument();
      } else {
        setErrorMsg(res.error || 'Error al anular el documento.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al anular documento.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await recordSupplierPaymentAction({
        purchase_document_id: document.id,
        amount: Number(paymentAmount),
        payment_date: paymentDate,
        method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Desembolso a proveedor registrado exitosamente.');
        setIsPaymentModalOpen(false);
        setPaymentReference('');
        setPaymentNotes('');
        await loadDocument();
      } else {
        setErrorMsg(res.error || 'Error al registrar el desembolso.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al registrar el desembolso.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
        <div style={{ color: 'var(--text-muted)' }}>Cargando detalle de la compra/gasto...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{ maxWidth: '960px', margin: '40px auto', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--color-danger)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '18px', color: 'var(--text-white)', marginBottom: '8px' }}>
          Documento no encontrado
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          {errorMsg || 'El documento solicitado no existe o no tiene permisos para visualizarlo.'}
        </p>
        <Link href="/purchases/expenses">
          <Button variant="secondary" icon={<ArrowLeft size={16} />}>
            Volver a Compras y Gastos
          </Button>
        </Link>
      </div>
    );
  }

  const isOverdue = document.balance_due > 0 && document.status !== 'void' && new Date(document.due_date) < new Date();

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
          <ArrowLeft size={18} /> Volver a Gastos y Compras
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {document.status === 'draft' && canWrite && (
            <Button
              variant="primary"
              disabled={actionLoading}
              icon={<Send size={16} />}
              onClick={handleOpenDocument}
            >
              {actionLoading ? 'Aprobando...' : 'Aprobar Documento'}
            </Button>
          )}

          {document.status !== 'void' && canVoid && (
            <Button
              variant="outline-danger"
              disabled={actionLoading || Number(document.paid_total) > 0}
              onClick={() => setIsVoidModalOpen(true)}
            >
              Anular Documento
            </Button>
          )}

          {document.status !== 'paid' && document.status !== 'void' && canWrite && (
            <Button
              variant="primary"
              icon={<CreditCard size={16} />}
              onClick={() => {
                setPaymentAmount(Number(document.balance_due));
                setIsPaymentModalOpen(true);
              }}
            >
              Registrar Pago / Abono
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

      {/* Main Document Card */}
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
                {document.document_number}
              </h1>
              <Badge status={document.status} />
              <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                {document.category}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
              Moneda: {document.currency_code} | Registrado en Supabase
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
                  document.status === 'void'
                    ? 'var(--text-dim)'
                    : document.balance_due > 0
                    ? '#f87171'
                    : 'var(--color-success)',
              }}
            >
              {formatCurrency(document.status === 'void' ? 0 : document.balance_due)}
            </div>
          </div>
        </div>

        {/* Supplier & Dates Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Proveedor
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-white)' }}>
              {document.supplier?.name || 'Proveedor no especificado'}
            </div>
            {document.supplier?.tax_id && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                NIT / Identificación: {document.supplier.tax_id}
              </div>
            )}
            {document.supplier?.email && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Email: {document.supplier.email}
              </div>
            )}
            {document.supplier?.phone && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Teléfono: {document.supplier.phone}
              </div>
            )}
            {document.supplier?.billing_address && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Dirección: {document.supplier.billing_address}, {document.supplier.city}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Fechas de Control (CxP)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de Documento:</span>
              <span>{formatDate(document.document_date)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de Vencimiento:</span>
              <span style={{ fontWeight: 600, color: isOverdue ? '#f87171' : 'inherit' }}>
                {formatDate(document.due_date)} {isOverdue && '(! Vencido)'}
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
                <th>Costo Unit.</th>
                <th>IVA / Tarifa</th>
                <th>IVA Descontable</th>
                <th>Total Línea</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item) => (
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
                  <td className="num-mono" style={{ fontSize: '13px', color: '#c084fc' }}>
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
          <div style={{ width: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subtotal (Base Gravable):</span>
              <span className="num-mono">{formatCurrency(document.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>IVA Descontable:</span>
              <span className="num-mono" style={{ color: '#c084fc' }}>+{formatCurrency(document.deductible_tax_total)}</span>
            </div>
            {Number(document.retention_total) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#f59e0b', marginBottom: '6px' }}>
                <span>Retenciones en la Fuente:</span>
                <span className="num-mono">-{formatCurrency(document.retention_total)}</span>
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
              <span>Total a Pagar:</span>
              <span className="num-mono">{formatCurrency(document.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-success)', marginBottom: '4px' }}>
              <span>Total Desembolsado:</span>
              <span className="num-mono">-{formatCurrency(document.paid_total)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 700,
                color: document.balance_due > 0 && document.status !== 'void' ? '#f87171' : 'var(--text-dim)',
              }}
            >
              <span>Saldo Pendiente:</span>
              <span className="num-mono">{formatCurrency(document.status === 'void' ? 0 : document.balance_due)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {document.notes && (
          <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Notas y Observaciones:</strong> {document.notes}
          </div>
        )}
      </div>

      {/* Payment History Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)' }}>
            Historial de Desembolsos y Pagos Realizados
          </h2>
          {document.status !== 'paid' && document.status !== 'void' && canWrite && (
            <Button
              variant="secondary"
              size="sm"
              icon={<CreditCard size={14} />}
              onClick={() => {
                setPaymentAmount(Number(document.balance_due));
                setIsPaymentModalOpen(true);
              }}
            >
              Nuevo Desembolso
            </Button>
          )}
        </div>

        {!document.payments || document.payments.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
            No se han registrado pagos o desembolsos aún para este documento.
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Monto Pagado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {document.payments.map((alloc) => {
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

      {/* Void Modal */}
      {isVoidModalOpen && (
        <Modal
          isOpen={isVoidModalOpen}
          onClose={() => setIsVoidModalOpen(false)}
          title="Anular Documento de Compra"
        >
          <form onSubmit={handleVoidDocument}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                ¿Está seguro de que desea anular el documento de compra{' '}
                <strong>{document.document_number}</strong>?
              </p>
              <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '16px' }}>
                Esta acción revertirá las entradas al inventario registradas por este documento y establecerá el saldo a cero. No se puede deshacer.
              </p>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                Motivo de la anulación (opcional):
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Ej: Factura duplicada, error en precios del proveedor..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={actionLoading}
              >
                {actionLoading ? 'Anulando...' : 'Confirmar Anulación'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Registrar Desembolso / Pago a Proveedor"
        >
          <form onSubmit={handleRegisterPayment}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <div>
                  Proveedor: <strong style={{ color: 'var(--text-white)' }}>{document.supplier?.name || 'General'}</strong>
                </div>
                <div>
                  Saldo pendiente por pagar:{' '}
                  <strong style={{ color: '#f87171' }}>{formatCurrency(document.balance_due)}</strong>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Monto a Pagar (COP) *
                </label>
                <input
                  type="number"
                  className="form-input"
                  step="0.01"
                  min="0.01"
                  max={document.balance_due}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  required
                />
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Puede registrar un pago parcial o el saldo total.
                </div>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Fecha de Pago *
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Método de Pago *
                </label>
                <select
                  className="form-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                >
                  <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CREDIT_CARD">Tarjeta de Crédito / Débito</option>
                  <option value="CHECK">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Número de Referencia / Comprobante
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: TRX-98765432, Cheque #102"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '4px' }}>
                  Notas de Pago
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Observaciones adicionales sobre el desembolso..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={actionLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={actionLoading || paymentAmount <= 0}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar Pago'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
