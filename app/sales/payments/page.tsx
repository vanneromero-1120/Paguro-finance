'use client';

// ============================================================================
// Paguro Finance - Customer Payments & Cash Receipts Ledger
// Real Supabase data, Multi-company isolated, RLS-enforced, Zero mock-store
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PaymentWithDetails, InvoiceWithCustomer } from '@/types/database';
import { getPaymentsAction, recordCustomerPaymentAction } from '@/lib/actions/payments';
import { getSalesInvoicesAction } from '@/lib/actions/invoices';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { createClient } from '@/lib/supabase/client';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Unpaid invoices for the registration modal
  const [eligibleInvoices, setEligibleInvoices] = useState<InvoiceWithCustomer[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // User role
  const [userRole, setUserRole] = useState<string | null>(null);
  const canWrite = userRole ? WRITE_ROLES.includes(userRole) : false;

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [payRes, invRes] = await Promise.all([
        getPaymentsAction(directionFilter, undefined, searchTerm),
        getSalesInvoicesAction(undefined, 'unpaid'),
      ]);

      if (payRes.success && payRes.data) {
        setPayments(payRes.data);
      } else {
        setErrorMsg(payRes.error || 'Error al cargar los pagos.');
      }

      if (invRes.success && invRes.data) {
        setEligibleInvoices(invRes.data);
        if (invRes.data.length > 0 && !selectedInvoiceId) {
          setSelectedInvoiceId(invRes.data[0].id);
          setAmount(Number(invRes.data[0].balance_due));
        }
      }
    } catch (err: any) {
      console.error('[PaymentsPage] Error loading data:', err);
      setErrorMsg(err?.message || 'Error inesperado al cargar datos de pagos.');
    } finally {
      setLoading(false);
    }
  }, [directionFilter, searchTerm, selectedInvoiceId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    const selected = eligibleInvoices.find((i) => i.id === invId);
    if (selected) {
      setAmount(Number(selected.balance_due));
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const targetInvoice = eligibleInvoices.find((i) => i.id === selectedInvoiceId);
    if (!targetInvoice) {
      setErrorMsg('Debe seleccionar una factura con saldo pendiente.');
      return;
    }

    if (amount <= 0) {
      setErrorMsg('El monto del cobro debe ser mayor a 0.');
      return;
    }

    if (amount > targetInvoice.balance_due) {
      setErrorMsg(
        `El monto ($${amount.toLocaleString()}) no puede superar el saldo pendiente de la factura ($${targetInvoice.balance_due.toLocaleString()}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await recordCustomerPaymentAction({
        invoice_id: targetInvoice.id,
        amount: Number(amount),
        payment_date: paymentDate,
        method: method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Cobro registrado exitosamente.');
        setIsModalOpen(false);
        setReference('');
        setNotes('');
        await loadData();
      } else {
        setErrorMsg(res.error || 'Error al procesar el cobro.');
      }
    } catch (err: any) {
      console.error('[PaymentsPage] Exception registering payment:', err);
      setErrorMsg(err?.message || 'Error inesperado al registrar el cobro.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedInvoice = eligibleInvoices.find((i) => i.id === selectedInvoiceId);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Cobros & Pagos (Tesorería)
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro individual de cobros a clientes y conciliación de saldos de facturas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="md" onClick={loadData} icon={<RefreshCw size={15} />}>
            Actualizar
          </Button>
          {canWrite && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                if (eligibleInvoices.length > 0) {
                  const first = eligibleInvoices[0];
                  setSelectedInvoiceId(first.id);
                  setAmount(Number(first.balance_due));
                }
                setIsModalOpen(true);
              }}
            >
              Nuevo Cobro
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
            placeholder="Buscar por cliente, referencia o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Direction Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { id: 'all', label: 'Todos los Registros' },
            { id: 'inbound', label: 'Cobros a Clientes' },
            { id: 'outbound', label: 'Pagos a Proveedores' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setDirectionFilter(pill.id as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                fontWeight: directionFilter === pill.id ? 600 : 400,
                backgroundColor: directionFilter === pill.id ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: directionFilter === pill.id ? 'var(--color-primary)' : 'var(--text-muted)',
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
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Cargando registros de tesorería...</div>
        </div>
      ) : payments.length === 0 ? (
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
            <CreditCard size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '8px' }}>
            No hay cobros ni pagos registrados
          </h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px' }}>
            {searchTerm || directionFilter !== 'all'
              ? 'No se encontraron movimientos que coincidan con los filtros aplicados.'
              : 'Cuando registre cobros asociados a facturas de venta, aparecerán en este libro mayor de tesorería.'}
          </p>
          {canWrite && !searchTerm && directionFilter === 'all' && eligibleInvoices.length > 0 && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setSelectedInvoiceId(eligibleInvoices[0].id);
                setAmount(Number(eligibleInvoices[0].balance_due));
                setIsModalOpen(true);
              }}
            >
              Registrar Primer Cobro
            </Button>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Contraparte</th>
                <th>Factura / Asignación</th>
                <th>Método</th>
                <th>Referencia</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const isInbound = p.direction === 'inbound';
                const firstAlloc = p.allocations && p.allocations.length > 0 ? p.allocations[0] : null;

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isInbound ? (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                            }}
                            title="Cobro recibido"
                          >
                            <ArrowDownRight size={14} />
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                            }}
                            title="Pago emitido"
                          >
                            <ArrowUpRight size={14} />
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {isInbound ? 'COBRO' : 'DESEMBOLSO'}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(p.payment_date)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                        {(p.counterparty as any)?.name || 'Sin contraparte'}
                      </div>
                      <div className="num-mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {(p.counterparty as any)?.tax_id}
                      </div>
                    </td>
                    <td>
                      {firstAlloc?.invoice ? (
                        <Link
                          href={`/sales/invoices/${firstAlloc.invoice.id}`}
                          style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '12px' }}
                        >
                          {firstAlloc.invoice.invoice_number}
                        </Link>
                      ) : firstAlloc ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Doc: {firstAlloc.document_id.slice(0, 8)}...</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Sin asignación</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px' }}>{p.method}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{p.reference || '-'}</td>
                    <td
                      className="num-mono"
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: isInbound ? '#34d399' : '#f87171',
                      }}
                    >
                      {isInbound ? '+' : '-'}{formatCurrency(p.amount)}
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

      {/* Modal: Register Customer Payment */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Cobro de Factura"
      >
        <form onSubmit={handleRegisterPayment}>
          {eligibleInvoices.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay facturas con saldo pendiente para aplicar un cobro.
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Factura a Cobrar *</label>
                <select
                  className="form-select"
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                >
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.customer?.name} (Saldo: ${Number(inv.balance_due).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: 'var(--text-dim)',
                  }}
                >
                  <div>Cliente: <strong style={{ color: 'var(--text-white)' }}>{selectedInvoice.customer?.name}</strong></div>
                  <div>Total Factura: <strong className="num-mono" style={{ color: 'var(--text-white)' }}>{formatCurrency(selectedInvoice.total)}</strong></div>
                  <div>Saldo Pendiente Máximo: <strong className="num-mono" style={{ color: '#fbbf24' }}>{formatCurrency(selectedInvoice.balance_due)}</strong></div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Monto a Cobrar ($ COP) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={selectedInvoice ? Number(selectedInvoice.balance_due) : undefined}
                  step="any"
                  className="form-input num-mono"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
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
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
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
                <label className="form-label">Referencia / No. Comprobante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Número de aprobación o recibo..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notas Adicionales</label>
                <textarea
                  rows={2}
                  className="form-textarea"
                  placeholder="Notas internas del cobro..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Registrar Cobro'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
