// ============================================================================
// Paguro Finance V1 - Financial Movements Server Actions
// Multi-company isolated, Duplicate Detection, Provenance Tracking & Audit Log
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  FinancialMovement,
  MovementCategory,
  MovementDirection,
  MovementSourceType,
  MovementTaxRelevance,
  MovementReviewStatus,
} from '@/types/v1-financial';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
  total?: number;
}

export interface MovementFilterInput {
  date_from?: string;
  date_to?: string;
  direction?: MovementDirection | 'ALL';
  category_id?: string;
  source_type?: MovementSourceType | 'ALL';
  tax_relevance?: MovementTaxRelevance | 'ALL';
  review_status?: MovementReviewStatus | 'ALL';
  search?: string;
  limit?: number;
}

export interface CreateMovementInput {
  movement_date: string;
  direction: MovementDirection;
  movement_type?: string;
  source_type: MovementSourceType;
  source_id?: string;
  description: string;
  counterparty?: string;
  counterparty_tax_id?: string;
  original_amount: number;
  currency?: string;
  exchange_rate?: number;
  category_id?: string;
  subcategory_id?: string;
  payment_method?: string;
  bank_account_id?: string;
  tax_relevance?: MovementTaxRelevance;
  document_id?: string;
  external_reference?: string;
  confidence_score?: number;
  review_status?: MovementReviewStatus;
}

/**
 * Check if a duplicate movement exists using invoice number, tax ID, amount, and date.
 */
export async function checkDuplicateMovement(
  companyId: string,
  amount: number,
  movementDate: string,
  externalRef?: string,
  counterpartyTaxId?: string
): Promise<{ isDuplicate: boolean; duplicateCandidate?: any }> {
  const supabase = createServerSupabaseClient();
  if (!supabase) return { isDuplicate: false };

  let query = supabase
    .from('financial_movements')
    .select('id, description, amount_cop, movement_date, external_reference, counterparty, counterparty_tax_id')
    .eq('company_id', companyId)
    .eq('amount_cop', amount);

  const { data: candidates } = await query;
  if (!candidates || candidates.length === 0) {
    return { isDuplicate: false };
  }

  // Check date within 2 days tolerance and matching reference or tax ID
  for (const c of candidates) {
    const d1 = new Date(c.movement_date).getTime();
    const d2 = new Date(movementDate).getTime();
    const dayDiff = Math.abs(d1 - d2) / (1000 * 3600 * 24);

    if (dayDiff <= 2) {
      if (
        (externalRef && c.external_reference && externalRef.toLowerCase() === c.external_reference.toLowerCase()) ||
        (counterpartyTaxId && c.counterparty_tax_id === counterpartyTaxId) ||
        dayDiff === 0
      ) {
        return { isDuplicate: true, duplicateCandidate: c };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Retrieves all normalized financial movements for the active company with filters.
 */
export async function getFinancialMovementsAction(
  filters?: MovementFilterInput
): Promise<ActionResponse<FinancialMovement[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('financial_movements')
      .select(`
        *,
        category:movement_categories!category_id(id, name, code, color, icon),
        bank_account:bank_accounts!bank_account_id(id, institution, account_name, masked_account_number, currency),
        document:documents!document_id(id, file_name, document_type, invoice_number, total_amount, pipeline_status)
      `)
      .eq('company_id', session.activeCompanyId)
      .order('movement_date', { ascending: false });

    if (filters?.direction && filters.direction !== 'ALL') {
      query = query.eq('direction', filters.direction);
    }

    if (filters?.category_id && filters.category_id !== 'ALL') {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters?.source_type && filters.source_type !== 'ALL') {
      query = query.eq('source_type', filters.source_type);
    }

    if (filters?.tax_relevance && filters.tax_relevance !== 'ALL') {
      query = query.eq('tax_relevance', filters.tax_relevance);
    }

    if (filters?.review_status && filters.review_status !== 'ALL') {
      query = query.eq('review_status', filters.review_status);
    }

    if (filters?.date_from) {
      query = query.gte('movement_date', filters.date_from);
    }

    if (filters?.date_to) {
      query = query.lte('movement_date', filters.date_to);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: movements, error } = await query;
    if (error) {
      console.error('[getFinancialMovementsAction] Query error:', error);
      return { success: false, error: error.message, data: [] };
    }

    let result = (movements || []) as FinancialMovement[];

    // In-memory text search over description, counterparty, reference
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.description.toLowerCase().includes(term) ||
          (m.counterparty && m.counterparty.toLowerCase().includes(term)) ||
          (m.external_reference && m.external_reference.toLowerCase().includes(term))
      );
    }

    return { success: true, data: result, total: result.length };
  } catch (err: any) {
    console.error('[getFinancialMovementsAction] Exception:', err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Creates a normalized financial movement with duplicate detection.
 */
export async function createFinancialMovementAction(
  input: CreateMovementInput
): Promise<ActionResponse<FinancialMovement>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Base de datos no disponible.' };
  }

  try {
    const exchangeRate = Number(input.exchange_rate) || 1.0;
    const originalAmount = Number(input.original_amount) || 0;
    const amountCop = Math.round(originalAmount * exchangeRate * 100) / 100;

    // Check duplicate
    const dupCheck = await checkDuplicateMovement(
      session.activeCompanyId,
      amountCop,
      input.movement_date,
      input.external_reference,
      input.counterparty_tax_id
    );

    let reviewStatus = input.review_status || 'CONFIRMED';
    let warningMsg: string | undefined = undefined;

    if (dupCheck.isDuplicate) {
      reviewStatus = 'REQUIRES_REVIEW';
      warningMsg = `Posible movimiento duplicado detectado con fecha similar y valor $${amountCop.toLocaleString('es-CO')}. Marcado para revisión humana.`;
    }

    const insertPayload = {
      company_id: session.activeCompanyId,
      movement_date: input.movement_date,
      direction: input.direction,
      movement_type: input.movement_type || 'STANDARD',
      source_type: input.source_type,
      source_id: input.source_id || null,
      description: input.description,
      counterparty: input.counterparty || null,
      counterparty_tax_id: input.counterparty_tax_id || null,
      original_amount: originalAmount,
      currency: input.currency || 'COP',
      exchange_rate: exchangeRate,
      amount_cop: amountCop,
      category_id: input.category_id || null,
      subcategory_id: input.subcategory_id || null,
      payment_method: input.payment_method || null,
      bank_account_id: input.bank_account_id || null,
      tax_relevance: input.tax_relevance || 'TAXABLE',
      tax_status: 'PENDING_MAPPING',
      document_id: input.document_id || null,
      external_reference: input.external_reference || null,
      confidence_score: input.confidence_score ?? 1.0,
      review_status: reviewStatus,
      created_by: session.userId,
    };

    const { data: movement, error } = await supabase
      .from('financial_movements')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('[createFinancialMovementAction] Insert error:', error);
      return { success: false, error: error.message };
    }

    // Record audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'MOVEMENT_CREATED',
      entity_type: 'financial_movements',
      entity_id: movement.id,
      after_json: movement,
      ip_or_context: `Dirección: ${movement.direction}, Monto: ${movement.amount_cop} COP`,
    });

    revalidatePath('/movements');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: movement,
      warning: warningMsg,
    };
  } catch (err: any) {
    console.error('[createFinancialMovementAction] Exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Updates review status and notes for a financial movement.
 */
export async function updateMovementReviewStatusAction(
  movementId: string,
  status: MovementReviewStatus,
  notes?: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: before } = await supabase
      .from('financial_movements')
      .select('*')
      .eq('id', movementId)
      .eq('company_id', session.activeCompanyId)
      .single();

    const { error } = await supabase
      .from('financial_movements')
      .update({
        review_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', movementId)
      .eq('company_id', session.activeCompanyId);

    if (error) return { success: false, error: error.message };

    // Record audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'MOVEMENT_REVIEW_UPDATED',
      entity_type: 'financial_movements',
      entity_id: movementId,
      before_json: before,
      after_json: { review_status: status, notes },
      ip_or_context: `Estado de revisión cambiado a ${status}. Notas: ${notes || 'Ninguna'}`,
    });

    revalidatePath('/movements');
    revalidatePath('/dashboard');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves movement categories for the active company.
 */
export async function getMovementCategoriesAction(includeInactive: boolean = false): Promise<ActionResponse<MovementCategory[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    let query = supabase
      .from('movement_categories')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query.order('name');

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: categories || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export interface CategoryInput {
  name: string;
  code?: string;
  parent_id?: string | null;
  direction?: 'INCOME' | 'EXPENSE' | 'BOTH';
  default_tax_relevance?: MovementTaxRelevance;
  color?: string;
  description?: string;
}

/**
 * Creates a new movement category or subcategory for the active company.
 */
export async function createMovementCategoryAction(
  input: CategoryInput
): Promise<ActionResponse<MovementCategory>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  // Authorization check: VIEWER cannot create categories
  if (session.role === 'VIEWER') {
    return { success: false, error: 'Acceso no autorizado: los visores no pueden modificar categorías.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const payload = {
      company_id: session.activeCompanyId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      parent_id: input.parent_id || null,
      direction: input.direction || 'EXPENSE',
      default_tax_relevance: input.default_tax_relevance || 'TAXABLE',
      color: input.color || '#0098FF',
      description: input.description?.trim() || null,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('movement_categories')
      .insert(payload)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Record audit trail
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'CATEGORY_CREATED',
      entity_type: 'movement_categories',
      entity_id: data.id,
      after_json: data,
      ip_or_context: `Categoría creada: ${data.name}`,
    });

    revalidatePath('/movements');
    revalidatePath('/settings');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Updates an existing movement category.
 */
export async function updateMovementCategoryAction(
  categoryId: string,
  input: Partial<CategoryInput & { is_active?: boolean }>
): Promise<ActionResponse<MovementCategory>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  if (session.role === 'VIEWER') {
    return { success: false, error: 'Acceso no autorizado: los visores no pueden modificar categorías.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: before } = await supabase
      .from('movement_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (!before) return { success: false, error: 'Categoría no encontrada.' };

    const updatePayload: Record<string, any> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('movement_categories')
      .update(updatePayload)
      .eq('id', categoryId)
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'CATEGORY_UPDATED',
      entity_type: 'movement_categories',
      entity_id: categoryId,
      before_json: before,
      after_json: updated,
      ip_or_context: `Categoría actualizada: ${updated.name}`,
    });

    revalidatePath('/movements');
    revalidatePath('/settings');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Safely deactivates a movement category (preserving historical references).
 */
export async function deactivateMovementCategoryAction(
  categoryId: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  if (session.role === 'VIEWER') {
    return { success: false, error: 'Acceso no autorizado: los visores no pueden desactivar categorías.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: before } = await supabase
      .from('movement_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (!before) return { success: false, error: 'Categoría no encontrada.' };

    const { error } = await supabase
      .from('movement_categories')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', categoryId)
      .eq('company_id', session.activeCompanyId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'CATEGORY_DEACTIVATED',
      entity_type: 'movement_categories',
      entity_id: categoryId,
      before_json: before,
      after_json: { is_active: false },
      ip_or_context: `Categoría desactivada: ${before.name} (preservada para trazabilidad histórica)`,
    });

    revalidatePath('/movements');
    revalidatePath('/settings');
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

