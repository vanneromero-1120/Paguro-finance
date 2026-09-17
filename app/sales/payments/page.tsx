'use client';

import React, { useState } from 'react';
import { Plus, Search, ArrowDownRight, ArrowUpRight, CreditCard, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  INITIAL_PAYMENTS,
  INITIAL_INVOICES,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_PURCHASES,
} from '@/lib/supabase/mock-store';
import { Payment } from '@/types/database';
import { validatePaymentAllocations, applyAllocationToBalance } from '@/lib/finance/payments';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

export default function PaymentsPage() {
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [notes, setNotes] = useState('');

  // Unpaid invoices or purchases depending on direction
  const eligibleInvoices = INITIAL_INVOICES.filter((i) => i.balance_due > 0 && i.status !== 'void');
  const eligiblePurchases = INITIAL_PURCHASES.filter((p) => p.balance_due > 0 && p.status !== 'void');

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('El monto del pago debe ser mayor a 0.');
      return;
    }

    if (direction === 'inbound') {
      const invoice = eligibleInvoices.find((i) => i.id === selectedDocId) || eligibleInvoices[0];
      if (!invoice) {
        setErrorMsg('No hay facturas con saldo pendiente para aplicar el cobro.');
        return;
      }

      const validation = validatePaymentAllocations(amount, [
        { documentId: invoice.invoice_number, amount, balanceDue: invoice.balance_due },
      ]);

      if (!validation.valid) {
        setErrorMsg(validation.error || 'Validación fallida');
        return;
      }

      // Update invoice balance and status
      const updated = applyAllocationToBalance(invoice.total, invoice.paid_total, amount);
      invoice.paid_total = updated.paidTotal;
      invoice.balance_due = updated.balanceDue;
      invoice.status = updated.status;

      const newPayment = {
        id: `pay-${Date.now()}`,
        company_id: 'c1111111-1111-1111-1111-111111111111',
        direction: 'inbound' as const,
        payment_date: paymentDate,
        amount,
        method,
        reference,
        counterparty_type: 'customer' as const,
        counterparty_id: invoice.customer_id,
        status: 'completed' as const,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        allocations: [
          {
            id: `pa-${Date.now()}`,
            payment_id: `pay-${Date.now()}`,
            document_type: 'sales_invoice' as const,
            document_id: invoice.id,
            amount,
            created_at: new Date().toISOString(),
          },
        ],
      };

      setPayments([newPayment, ...payments]);
      setIsModalOpen(false);
      setAmount(0);
      setReference('');
    } else {
      // Outbound disbursement to supplier
      const purchase = eligiblePurchases.find((p) => p.id === selectedDocId) || eligiblePurchases[0];
      if (!purchase) {
        setErrorMsg('No hay compras con saldo pendiente para aplicar el desembolso.');
        return;
      }

      const validation = validatePaymentAllocations(amount, [
        { documentId: purchase.document_number, amount, balanceDue: purchase.balance_due },
      ]);

      if (!validation.valid) {
        setErrorMsg(validation.error || 'Validación fallida');
        return;
      }

      const updated = applyAllocationToBalance(purchase.total, purchase.paid_total, amount);
      purchase.paid_total = updated.paidTotal;
      purchase.balance_due = updated.balanceDue;
      purchase.status = updated.status;

      const newPayment = {
        id: `pay-${Date.now()}`,
        company_id: 'c1111111-1111-1111-1111-111111111111',
        direction: 'outbound' as const,
        payment_date: paymentDate,
        amount,
        method,
        reference,
        counterparty_type: 'supplier' as const,
        counterparty_id: purchase.supplier_id || '',
        status: 'completed' as const,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        allocations: [
          {
            id: `pa-${Date.now()}`,
            payment_id: `pay-${Date.now()}`,
            document_type: 'purchase_document' as const,
            document_id: purchase.id,
            amount,
            created_at: new Date().toISOString(),
          },
        ],
      };

      setPayments([newPayment, ...payments]);
      setIsModalOpen(false);
      setAmount(0);
      setReference('');
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (directionFilter === 'all') return true;
    return p.direction === directionFilter;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-white)' }}>
            Gestión de Cobros & Desembolsos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Registro de cobros recibidos de clientes y pagos efectuados a proveedores con asignación de saldo.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setErrorMsg(null);
            setIsModalOpen(true);
          }}
        >
          Registrar Pago / Cobro
        </Button>
      </div>

      {/* Direction Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'all', label: 'Todos los Movimientos' },
          { id: 'inbound', label: 'Cobros Recibidos (CxC)' },
          { id: 'outbound', label: 'Desembolsos Realizados (CxP)' },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setDirectionFilter(pill.id as any)}
            style={{
              padding: '6px 14px',
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

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo de Flujo</th>
              <th>Fecha</th>
              <th>Contraparte</th>
              <th>Método</th>
              <th>Referencia / Comprobante</th>
              <th>Monto Aplicado</th>
              <th>Documentos Asignados</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p) => {
              const isInbound = p.direction === 'inbound';
              const counterparty = isInbound
                ? INITIAL_CUSTOMERS.find((c) => c.id === p.counterparty_id)?.name || 'Cliente'
                : INITIAL_SUPPLIERS.find((s) => s.id === p.counterparty_id)?.name || 'Proveedor';

              return (
                <tr key={p.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isInbound ? 'var(--color-success)' : 'var(--color-danger)',
                      }}
                    >
                      {isInbound ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      {isInbound ? 'Cobro Recibido' : 'Pago Proveedor'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {formatDate(p.payment_date)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{counterparty}</div>
                  </td>
                  <td style={{ fontSize: '12px' }}>{p.method}</td>
                  <td className="num-mono" style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    {p.reference || '-'}
                  </td>
                  <td
                    className="num-mono"
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: isInbound ? '#34d399' : '#f87171',
                    }}
                  >
                    {isInbound ? '+' : '-'} {formatCurrency(p.amount)}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {p.allocations.length} documento(s)
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

      {/* Modal: Register Payment */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Registrar Operación de Pago"
      >
        <form onSubmit={handleRegisterPayment}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '12px',
                marginBottom: '16px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Operación *</label>
              <select
                className="form-select"
                value={direction}
                onChange={(e) => {
                  setDirection(e.target.value as 'inbound' | 'outbound');
                  setSelectedDocId('');
                }}
              >
                <option value="inbound">Cobro de Cliente (Inbound)</option>
                <option value="outbound">Pago a Proveedor (Outbound)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha del Pago *</label>
              <input
                type="date"
                required
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Documento a Cancelar / Aplicar Saldo *</label>
            <select
              className="form-select"
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                if (direction === 'inbound') {
                  const inv = eligibleInvoices.find((i) => i.id === e.target.value);
                  if (inv) setAmount(inv.balance_due);
                } else {
                  const pur = eligiblePurchases.find((p) => p.id === e.target.value);
                  if (pur) setAmount(pur.balance_due);
                }
              }}
            >
              <option value="">Seleccione documento con saldo pendiente...</option>
              {direction === 'inbound'
                ? eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - Saldo: {formatCurrency(inv.balance_due)}
                    </option>
                  ))
                : eligiblePurchases.map((pur) => (
                    <option key={pur.id} value={pur.id}>
                      {pur.document_number} - Saldo: {formatCurrency(pur.balance_due)}
                    </option>
                  ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Monto del Pago (COP) *</label>
              <input
                type="number"
                min="1"
                required
                className="form-input num-mono"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
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
                <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                <option value="CASH">Efectivo</option>
                <option value="CHECK">Cheque</option>
                <option value="PLATFORM">Pasarela de Pago</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Referencia / Comprobante Bancario</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. TRANSF-BANCOLOMBIA-9981"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notas Adicionales</label>
            <textarea
              rows={2}
              className="form-textarea"
              placeholder="Observaciones del cobro o desembolso..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Aplicar y Guardar Pago
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
