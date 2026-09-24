// ============================================================================
// Paguro Finance V1 - Banking & Reconciliation Server Actions
// Multi-company isolated, Reconciles Bank Transactions with Movements/Documents
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  BankAccount,
  BankTransaction,
  BankMatchStatus,
  FinancialMovement,
} from '@/types/v1-financial';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
}

export interface BankTransactionFilterInput {
  bank_account_id?: string;
  match_status?: BankMatchStatus | 'ALL';
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CreateBankAccountInput {
  institution: string;
  account_name: string;
  account_type?: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'VIRTUAL_WALLET';
  masked_account_number: string;
  currency?: string;
  integration_provider?: string;
}

export interface CreateBankTransactionInput {
  bank_account_id: string;
  external_transaction_id?: string;
  posted_at: string;
  description: string;
  amount: number;
  currency?: string;
  direction: 'INFLOW' | 'OUTFLOW';
  balance_after?: number;
  merchant?: string;
  counterparty?: string;
  reference?: string;
}

/**
 * Retrieves all bank accounts for the active company.
 */
export async function getBankAccountsAction(): Promise<ActionResponse<BankAccount[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('account_name');

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Creates a new bank account. Never stores online banking passwords.
 */
export async function createBankAccountAction(
  input: CreateBankAccountInput
): Promise<ActionResponse<BankAccount>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        company_id: session.activeCompanyId,
        institution: input.institution,
        account_name: input.account_name,
        account_type: input.account_type || 'CHECKING',
        masked_account_number: input.masked_account_number,
        currency: input.currency || 'COP',
        integration_provider: input.integration_provider || null,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'BANK_ACCOUNT_CREATED',
      entity_type: 'bank_accounts',
      entity_id: data.id,
      after_json: data,
      ip_or_context: `Institución: ${data.institution}, Cuenta: ${data.account_name}`,
    });

    revalidatePath('/integrations');
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves bank transactions with account details and match statuses.
 */
export async function getBankTransactionsAction(
  filters?: BankTransactionFilterInput
): Promise<ActionResponse<BankTransaction[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    let query = supabase
      .from('bank_transactions')
      .select(`
        *,
        bank_account:bank_accounts!bank_account_id(id, institution, account_name, masked_account_number, currency),
        financial_movement:financial_movements!financial_movement_id(id, description, amount_cop, movement_date, counterparty)
      `)
      .eq('company_id', session.activeCompanyId)
      .order('posted_at', { ascending: false });

    if (filters?.bank_account_id && filters.bank_account_id !== 'ALL') {
      query = query.eq('bank_account_id', filters.bank_account_id);
    }

    if (filters?.match_status && filters.match_status !== 'ALL') {
      query = query.eq('match_status', filters.match_status);
    }

    if (filters?.date_from) {
      query = query.gte('posted_at', `${filters.date_from}T00:00:00.000Z`);
    }

    if (filters?.date_to) {
      query = query.lte('posted_at', `${filters.date_to}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };

    let result = (data || []) as BankTransaction[];

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      result = result.filter(
        (tx) =>
          tx.description.toLowerCase().includes(term) ||
          (tx.merchant && tx.merchant.toLowerCase().includes(term)) ||
          (tx.counterparty && tx.counterparty.toLowerCase().includes(term)) ||
          (tx.reference && tx.reference.toLowerCase().includes(term))
      );
    }

    return { success: true, data: result, total: result.length };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Creates a normalized bank transaction.
 */
export async function createBankTransactionAction(
  input: CreateBankTransactionInput
): Promise<ActionResponse<BankTransaction>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data, error } = await supabase
      .from('bank_transactions')
      .insert({
        company_id: session.activeCompanyId,
        bank_account_id: input.bank_account_id,
        external_transaction_id: input.external_transaction_id || null,
        posted_at: input.posted_at,
        description: input.description,
        amount: Math.abs(Number(input.amount)),
        currency: input.currency || 'COP',
        direction: input.direction,
        balance_after: input.balance_after ?? null,
        merchant: input.merchant || null,
        counterparty: input.counterparty || null,
        reference: input.reference || null,
        match_status: 'UNMATCHED',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/movements');
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Reconciles bank transaction: Finds candidates in financial_movements based on amount, date tolerance, counterparty.
 */
export async function suggestBankReconciliationAction(
  bankTransactionId: string
): Promise<ActionResponse<{ candidates: (FinancialMovement & { confidence_score: number; match_reason: string })[] }>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: bankTx, error: txErr } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', bankTransactionId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (txErr || !bankTx) return { success: false, error: 'Transacción bancaria no encontrada.' };

    const expectedDirection = bankTx.direction === 'INFLOW' ? 'INCOME' : 'EXPENSE';
    const txDate = new Date(bankTx.posted_at);

    // Search movements matching direction and approximate amount (tolerance 1%)
    const minAmount = bankTx.amount * 0.99;
    const maxAmount = bankTx.amount * 1.01;

    const { data: movements } = await supabase
      .from('financial_movements')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .eq('direction', expectedDirection)
      .gte('amount_cop', minAmount)
      .lte('amount_cop', maxAmount);

    const candidates: any[] = [];

    (movements || []).forEach((m: any) => {
      const movDate = new Date(m.movement_date);
      const daysDiff = Math.abs(txDate.getTime() - movDate.getTime()) / (1000 * 3600 * 24);

      let score = 0.5;
      let reasons: string[] = [];

      // Exact amount match
      if (Math.abs(m.amount_cop - bankTx.amount) < 0.01) {
        score += 0.3;
        reasons.push('Monto exacto');
      }

      // Date match within 3 days
      if (daysDiff <= 1) {
        score += 0.15;
        reasons.push('Misma fecha / 24h');
      } else if (daysDiff <= 3) {
        score += 0.05;
        reasons.push(`Diferencia de ${Math.round(daysDiff)} días`);
      }

      // Description / counterparty overlap
      if (m.counterparty && bankTx.description.toLowerCase().includes(m.counterparty.toLowerCase())) {
        score += 0.1;
        reasons.push('Coincidencia de contraparte');
      }

      candidates.push({
        ...m,
        confidence_score: Math.min(Number(score.toFixed(2)), 0.99),
        match_reason: reasons.join(', ') || 'Aproximación de monto',
      });
    });

    candidates.sort((a, b) => b.confidence_score - a.confidence_score);

    return { success: true, data: { candidates } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Confirms reconciliation between a bank transaction and a financial movement.
 * Non-destructive, traceable and logged in audit trail.
 */
export async function confirmBankMatchAction(
  bankTransactionId: string,
  financialMovementId: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    // 1. Update bank transaction
    const { error: txErr } = await supabase
      .from('bank_transactions')
      .update({
        match_status: 'MATCHED',
        financial_movement_id: financialMovementId,
        confidence_score: 1.0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankTransactionId)
      .eq('company_id', session.activeCompanyId);

    if (txErr) return { success: false, error: txErr.message };

    // 2. Update financial movement with bank account linkage
    const { data: bankTx } = await supabase
      .from('bank_transactions')
      .select('bank_account_id')
      .eq('id', bankTransactionId)
      .single();

    if (bankTx?.bank_account_id) {
      await supabase
        .from('financial_movements')
        .update({
          bank_account_id: bankTx.bank_account_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', financialMovementId)
        .eq('company_id', session.activeCompanyId);
    }

    // 3. Record audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'BANK_TRANSACTION_RECONCILED',
      entity_type: 'bank_transactions',
      entity_id: bankTransactionId,
      after_json: { bankTransactionId, financialMovementId },
      ip_or_context: 'Conciliación bancaria confirmada manualmente por usuario.',
    });

    revalidatePath('/movements');
    revalidatePath('/dashboard');
    return { success: true, data: true, message: 'Movimiento bancario conciliado exitosamente.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Reverses a bank reconciliation match safely.
 */
export async function unmatchBankTransactionAction(
  bankTransactionId: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { error } = await supabase
      .from('bank_transactions')
      .update({
        match_status: 'UNMATCHED',
        financial_movement_id: null,
        confidence_score: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankTransactionId)
      .eq('company_id', session.activeCompanyId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'BANK_TRANSACTION_UNMATCHED',
      entity_type: 'bank_transactions',
      entity_id: bankTransactionId,
      ip_or_context: 'Desconciliación bancaria realizada por usuario.',
    });

    revalidatePath('/movements');
    revalidatePath('/dashboard');
    return { success: true, data: true, message: 'Conciliación deshecha correctamente.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
