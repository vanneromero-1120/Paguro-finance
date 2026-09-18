// ============================================================================
// Paguro Finance - Customer Payment Server Actions
// Multi-company isolated, RLS-enforced, overpayment prevention, audit-logged
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  Payment,
  PaymentWithDetails,
  CreatePaymentInput,
  SalesInvoice,
  Customer,
  Supplier,
} from '@/types/database';
import { roundHalfUp } from '@/lib/finance/calculations';
import { validatePaymentAllocations } from '@/lib/finance/payments';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'VIEWER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];
const VOID_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Retrieves all payments for the active company, enriched with counterparty and allocation details.
 */
export async function getPaymentsAction(
  directionFilter?: string,
  counterpartyId?: string,
  search?: string
): Promise<ActionResponse<PaymentWithDetails[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  if (!READ_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para consultar pagos.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('payments')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (directionFilter && directionFilter !== 'all') {
      query = query.eq('direction', directionFilter);
    }

    if (counterpartyId && counterpartyId !== 'all') {
      query = query.eq('counterparty_id', counterpartyId);
    }

    query = query.order('payment_date', { ascending: false });

    const { data: rawPayments, error: payErr } = await query;
    if (payErr) {
      console.error('[getPaymentsAction] Query error:', payErr);
      return { success: false, error: payErr.message, data: [] };
    }

    if (!rawPayments || rawPayments.length === 0) {
      return { success: true, data: [] };
    }

    // 1. Fetch counterparties (customers & suppliers)
    const customerIds = Array.from(
      new Set(
        rawPayments
          .filter((p: any) => p.counterparty_type === 'customer')
          .map((p: any) => p.counterparty_id)
      )
    );
    const supplierIds = Array.from(
      new Set(
        rawPayments
          .filter((p: any) => p.counterparty_type === 'supplier')
          .map((p: any) => p.counterparty_id)
      )
    );

    const customerMap = new Map<string, Customer>();
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .in('id', customerIds)
        .eq('company_id', session.activeCompanyId);
      (customers || []).forEach((c: Customer) => customerMap.set(c.id, c));
    }

    const supplierMap = new Map<string, Supplier>();
    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('*')
        .in('id', supplierIds)
        .eq('company_id', session.activeCompanyId);
      (suppliers || []).forEach((s: Supplier) => supplierMap.set(s.id, s));
    }

    // 2. Fetch allocations for these payments
    const paymentIds = rawPayments.map((p: any) => p.id);
    const { data: allocations } = await supabase
      .from('payment_allocations')
      .select('*')
      .in('payment_id', paymentIds);

    // Fetch invoice details for allocated sales invoices
    const invoiceIds = Array.from(
      new Set(
        (allocations || [])
          .filter((a: any) => a.document_type === 'sales_invoice')
          .map((a: any) => a.document_id)
      )
    );

    const invoiceMap = new Map<string, SalesInvoice>();
    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabase
        .from('sales_invoices')
        .select('*')
        .in('id', invoiceIds)
        .eq('company_id', session.activeCompanyId);
      (invoices || []).forEach((inv: SalesInvoice) => invoiceMap.set(inv.id, inv));
    }

    // Map allocations by payment id
    const allocMap = new Map<string, any[]>();
    (allocations || []).forEach((a: any) => {
      const list = allocMap.get(a.payment_id) || [];
      list.push({
        ...a,
        amount: Number(a.amount),
        invoice: a.document_type === 'sales_invoice' ? invoiceMap.get(a.document_id) || null : null,
      });
      allocMap.set(a.payment_id, list);
    });

    let enriched: PaymentWithDetails[] = rawPayments.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
      counterparty:
        p.counterparty_type === 'customer'
          ? customerMap.get(p.counterparty_id) || null
          : supplierMap.get(p.counterparty_id) || null,
      allocations: allocMap.get(p.id) || [],
    }));

    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      enriched = enriched.filter((pay) => {
        const counterpartyName = (pay.counterparty as any)?.name?.toLowerCase() || '';
        const ref = (pay.reference || '').toLowerCase();
        const invoiceNums = (pay.allocations || [])
          .map((a) => a.invoice?.invoice_number?.toLowerCase() || '')
          .join(' ');
        return counterpartyName.includes(term) || ref.includes(term) || invoiceNums.includes(term);
      });
    }

    return { success: true, data: enriched };
  } catch (err: any) {
    console.error('[getPaymentsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener pagos.', data: [] };
  }
}

/**
 * Records a customer payment linked to a sales invoice.
 * Server-side checks: amount > 0, invoice ownership, overpayment prevention, void/paid check.
 */
export async function recordCustomerPaymentAction(
  input: CreatePaymentInput
): Promise<ActionResponse<Payment>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Super Administrador, Administrador o Finanzas.',
    };
  }

  if (!input.invoice_id) {
    return { success: false, error: 'Debe especificar la factura a la cual aplicar el cobro.' };
  }

  const rawAmount = Number(input.amount);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    return { success: false, error: 'El monto del cobro debe ser un número positivo mayor a 0.' };
  }
  const paymentAmount = roundHalfUp(rawAmount, 2);

  if (!input.payment_date) {
    return { success: false, error: 'Debe especificar la fecha de cobro.' };
  }

  if (!input.method) {
    return { success: false, error: 'Debe seleccionar un método de pago.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch invoice and verify company isolation and status
    const { data: invoice, error: invErr } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', input.invoice_id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (invErr || !invoice) {
      return { success: false, error: 'Factura no encontrada o no pertenece a su empresa.' };
    }

    // 2. Validate invoice status
    if (invoice.status === 'void') {
      return { success: false, error: 'No se pueden registrar cobros en una factura anulada.' };
    }

    const currentBalanceDue = Number(invoice.balance_due);
    if (currentBalanceDue <= 0 || invoice.status === 'paid') {
      return { success: false, error: 'La factura ya se encuentra pagada en su totalidad.' };
    }

    // 3. Overpayment Prevention: payment cannot exceed remaining balance
    if (paymentAmount > currentBalanceDue) {
      return {
        success: false,
        error: `El monto del cobro ($${paymentAmount.toLocaleString()}) no puede exceder el saldo pendiente de la factura ($${currentBalanceDue.toLocaleString()}).`,
      };
    }

    // Validate allocation logic
    const allocValidation = validatePaymentAllocations(paymentAmount, [
      {
        documentId: invoice.invoice_number,
        amount: paymentAmount,
        balanceDue: currentBalanceDue,
      },
    ]);

    if (!allocValidation.valid) {
      return { success: false, error: allocValidation.error };
    }

    // 4. Insert Payment record
    const { data: payment, error: payInsErr } = await supabase
      .from('payments')
      .insert({
        company_id: session.activeCompanyId,
        direction: 'inbound',
        payment_date: input.payment_date,
        amount: paymentAmount,
        method: input.method,
        reference: input.reference?.trim() || null,
        counterparty_type: 'customer',
        counterparty_id: invoice.customer_id,
        status: 'completed',
        notes: input.notes?.trim() || null,
        created_by: session.id,
      })
      .select()
      .single();

    if (payInsErr || !payment) {
      console.error('[recordCustomerPaymentAction] Error inserting payment:', payInsErr);
      return { success: false, error: payInsErr?.message || 'Error al crear el registro de pago.' };
    }

    // 5. Insert Payment Allocation
    // Note: The database trigger `trg_payment_allocation_sync` will authoritatively
    // update paid_total, balance_due, and status on `sales_invoices`.
    const { error: allocInsErr } = await supabase
      .from('payment_allocations')
      .insert({
        payment_id: payment.id,
        document_type: 'sales_invoice',
        document_id: invoice.id,
        amount: paymentAmount,
      });

    if (allocInsErr) {
      console.error('[recordCustomerPaymentAction] Allocation insert error:', allocInsErr);
      // Attempt rollback of payment header
      await supabase.from('payments').delete().eq('id', payment.id);
      return { success: false, error: 'Error al asociar la asignación del cobro a la factura.' };
    }

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'payment',
      entity_id: payment.id,
      old_values: null,
      new_values: {
        amount: payment.amount,
        direction: 'inbound',
        method: payment.method,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        customer_id: invoice.customer_id,
        reference: payment.reference,
      },
    });

    revalidatePath('/sales/invoices');
    revalidatePath(`/sales/invoices/${invoice.id}`);
    revalidatePath('/sales/payments');

    return {
      success: true,
      data: payment,
      message: `Cobro de $${paymentAmount.toLocaleString()} registrado con éxito para la factura ${invoice.invoice_number}.`,
    };
  } catch (err: any) {
    console.error('[recordCustomerPaymentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al registrar el cobro.' };
  }
}

/**
 * Voids a payment record and reverses its allocation, restoring invoice balance.
 * Restricted to SUPER_ADMIN and ADMIN.
 */
export async function voidPaymentAction(
  paymentId: string,
  reason?: string
): Promise<ActionResponse<Payment>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!VOID_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo Super Administradores y Administradores pueden anular cobros.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch payment
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (payErr || !payment) {
      return { success: false, error: 'Pago no encontrado o no pertenece a su empresa.' };
    }

    if (payment.status === 'void') {
      return { success: false, error: 'El pago ya se encuentra anulado.' };
    }

    // 2. Delete payment allocations (Trigger `trg_payment_allocation_sync` on DELETE
    // will subtract the amount delta from sales_invoices paid_total and restore balance_due & status)
    const { error: allocDelErr } = await supabase
      .from('payment_allocations')
      .delete()
      .eq('payment_id', paymentId);

    if (allocDelErr) {
      console.error('[voidPaymentAction] Allocation delete error:', allocDelErr);
      return { success: false, error: 'Error al revertir las asignaciones del pago.' };
    }

    // 3. Mark payment as void
    const { data: updatedPayment, error: updErr } = await supabase
      .from('payments')
      .update({
        status: 'void',
        notes: payment.notes
          ? `${payment.notes}\n[ANULADO]: ${reason || 'Sin motivo especificado'}`
          : `[ANULADO]: ${reason || 'Sin motivo especificado'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (updErr || !updatedPayment) {
      return { success: false, error: updErr?.message || 'Error al anular el pago.' };
    }

    // 4. Audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'VOID',
      entity_type: 'payment',
      entity_id: paymentId,
      old_values: { status: 'completed', amount: payment.amount },
      new_values: { status: 'void', reason: reason || null },
    });

    revalidatePath('/sales/invoices');
    revalidatePath('/sales/payments');

    return {
      success: true,
      data: updatedPayment,
      message: 'Cobro anulado y saldo de factura restaurado exitosamente.',
    };
  } catch (err: any) {
    console.error('[voidPaymentAction] Exception:', err);
    return { success: false, error: err?.message || 'Error inesperado al anular el pago.' };
  }
}
