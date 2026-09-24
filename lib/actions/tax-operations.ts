// ============================================================================
// Paguro Finance V1 - Colombian Tax Operations Server Actions
// Tax Profile, Mapping Engine (IVA, Retefuente, ICA), Obligations & Notifications
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  CompanyTaxProfile,
  TaxObligation,
  TaxObligationStatus,
  TaxReviewStatus,
  TaxNotification,
} from '@/types/v1-financial';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TaxPositionSummary {
  period_label: string;
  generated_iva: number;
  deductible_iva: number;
  estimated_net_iva: number;
  iva_position_type: 'PAYABLE' | 'CREDIT_BALANCE';
  withholding_tax_estimated: number;
  ica_estimated: number;
  income_tax_provision_estimated: number;
  total_tax_liabilities_estimated: number;
  tax_status: TaxReviewStatus;
  transactions_analyzed: number;
  disclaimer: string;
}

export interface UpdateCompanyTaxProfileInput {
  tax_id?: string;
  legal_name?: string;
  country?: string;
  city?: string;
  municipality?: string;
  tax_regime?: string;
  rut_responsibilities?: string[];
  iva_responsible?: boolean;
  income_tax_responsibility?: boolean;
  withholding_agent?: boolean;
  ica_configuration?: {
    rate: number;
    municipality: string;
    activity_code: string;
  };
  fiscal_year?: number;
  accounting_contact?: string;
  tax_advisor_contact?: string;
}

export interface CreateTaxObligationInput {
  name: string;
  tax_type: string;
  period: string;
  due_date: string;
  estimated_amount: number;
  notes?: string;
}

/**
 * Retrieves the company tax profile.
 */
export async function getCompanyTaxProfileAction(): Promise<ActionResponse<CompanyTaxProfile>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    let { data: profile } = await supabase
      .from('company_tax_profile')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .maybeSingle();

    if (!profile) {
      // Auto-initialize if absent
      const { data: comp } = await supabase
        .from('companies')
        .select('legal_name, tax_id')
        .eq('id', session.activeCompanyId)
        .single();

      const { data: created } = await supabase
        .from('company_tax_profile')
        .insert({
          company_id: session.activeCompanyId,
          tax_id: comp?.tax_id || '901.458.120-1',
          legal_name: comp?.legal_name || 'Paguro Corp S.A.S.',
          country: 'Colombia',
          city: 'Medellín',
          municipality: 'Medellín',
          tax_regime: 'RESPONSABLE_DE_IVA',
          rut_responsibilities: ['05 - Impto sobre la renta', '48 - Impuesto sobre las ventas - IVA'],
          iva_responsible: true,
          income_tax_responsibility: true,
          withholding_agent: false,
          fiscal_year: 2026,
        })
        .select()
        .single();

      profile = created;
    }

    return { success: true, data: profile };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Updates the company tax profile.
 */
export async function updateCompanyTaxProfileAction(
  input: UpdateCompanyTaxProfileInput
): Promise<ActionResponse<CompanyTaxProfile>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data, error } = await supabase
      .from('company_tax_profile')
      .update({
        ...input,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', session.activeCompanyId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'TAX_PROFILE_UPDATED',
      entity_type: 'company_tax_profile',
      entity_id: data.id,
      after_json: data,
      ip_or_context: 'Perfil tributario actualizado por usuario autorizado.',
    });

    revalidatePath('/taxes');
    revalidatePath('/settings');
    return { success: true, data, message: 'Perfil tributario actualizado con éxito.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Tax Mapping Engine:
 * Analyzes financial movements, documents, and company tax profile to compute estimated tax liabilities.
 */
export async function calculateTaxPositionAction(
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResponse<TaxPositionSummary>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    // 1. Fetch Tax Profile
    const { data: taxProfile } = await supabase
      .from('company_tax_profile')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .maybeSingle();

    const icaRate = taxProfile?.ica_configuration?.rate || 0.007; // 7 por mil default

    // 2. Fetch Movements within range
    let query = supabase
      .from('financial_movements')
      .select('amount_cop, direction, tax_relevance, tax_status')
      .eq('company_id', session.activeCompanyId);

    if (dateFrom) query = query.gte('movement_date', dateFrom);
    if (dateTo) query = query.lte('movement_date', dateTo);

    const { data: movements, error } = await query;
    if (error) return { success: false, error: error.message };

    let totalIncome = 0;
    let totalExpense = 0;
    let count = (movements || []).length;

    (movements || []).forEach((m) => {
      if (m.direction === 'INCOME') {
        totalIncome += Number(m.amount_cop);
      } else {
        totalExpense += Number(m.amount_cop);
      }
    });

    // Approximate IVA (19% standard Colombian IVA on taxable movements)
    const generatedIva = Math.round(totalIncome * 0.19 * 100) / 100;
    const deductibleIva = Math.round(totalExpense * 0.19 * 100) / 100;
    const netIva = generatedIva - deductibleIva;

    // Approximate Retefuente (3.5% / 4% general services / goods)
    const withholdingTax = Math.round(totalExpense * 0.035 * 100) / 100;

    // Approximate ICA on gross revenue
    const icaEstimated = Math.round(totalIncome * icaRate * 100) / 100;

    // Approximate income tax provision (35% corporate tax on estimated net profit before tax)
    const netOperating = Math.max(0, totalIncome - totalExpense);
    const incomeTaxProvision = Math.round(netOperating * 0.35 * 100) / 100;

    const totalLiabilities = Math.max(0, netIva) + withholdingTax + icaEstimated;

    return {
      success: true,
      data: {
        period_label: dateFrom && dateTo ? `${dateFrom} a ${dateTo}` : 'Año Fiscal 2026',
        generated_iva: generatedIva,
        deductible_iva: deductibleIva,
        estimated_net_iva: Math.abs(netIva),
        iva_position_type: netIva >= 0 ? 'PAYABLE' : 'CREDIT_BALANCE',
        withholding_tax_estimated: withholdingTax,
        ica_estimated: icaEstimated,
        income_tax_provision_estimated: incomeTaxProvision,
        total_tax_liabilities_estimated: totalLiabilities,
        tax_status: 'ESTIMATED',
        transactions_analyzed: count,
        disclaimer:
          'Información financiera de control gerencial. Las estimaciones aquí presentadas son referenciales y no constituyen una liquidación oficial ante la DIAN ni reemplazan la asesoría del contador público oficial.',
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves tax obligations with days remaining and status calculation.
 */
export async function getTaxObligationsAction(
  taxType?: string
): Promise<ActionResponse<TaxObligation[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    let query = supabase
      .from('tax_obligations')
      .select(`
        *,
        evidence_document:documents!evidence_document_id(id, file_name, storage_path)
      `)
      .eq('company_id', session.activeCompanyId)
      .order('due_date', { ascending: true });

    if (taxType && taxType !== 'ALL') {
      query = query.eq('tax_type', taxType);
    }

    const { data: obligations, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = (obligations || []).map((o: any) => {
      const dueDate = new Date(o.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

      let calculatedStatus: TaxObligationStatus = o.status;
      if (o.status !== 'PAID' && o.status !== 'FILED' && o.status !== 'NOT_APPLICABLE') {
        if (diffDays < 0) {
          calculatedStatus = 'OVERDUE';
        } else if (diffDays === 0) {
          calculatedStatus = 'DUE_TODAY';
        } else if (diffDays <= 7) {
          calculatedStatus = 'DUE_SOON';
        } else {
          calculatedStatus = 'UPCOMING';
        }
      }

      return {
        ...o,
        status: calculatedStatus,
        days_remaining: diffDays,
      } as TaxObligation;
    });

    return { success: true, data: enriched };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Creates a tax obligation.
 */
export async function createTaxObligationAction(
  input: CreateTaxObligationInput
): Promise<ActionResponse<TaxObligation>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data, error } = await supabase
      .from('tax_obligations')
      .insert({
        company_id: session.activeCompanyId,
        name: input.name,
        tax_type: input.tax_type,
        period: input.period,
        due_date: input.due_date,
        estimated_amount: input.estimated_amount,
        status: 'UPCOMING',
        source: 'MANUAL_ENTRY',
        review_status: 'ESTIMATED',
        notes: input.notes || null,
        responsible_user: session.userId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'TAX_OBLIGATION_CREATED',
      entity_type: 'tax_obligations',
      entity_id: data.id,
      after_json: data,
      ip_or_context: `Obligación: ${data.name}, Vence: ${data.due_date}`,
    });

    revalidatePath('/obligations');
    revalidatePath('/taxes');
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Updates status of a tax obligation (PREPARED, FILED, PAID).
 */
export async function updateTaxObligationStatusAction(
  id: string,
  status: TaxObligationStatus,
  actualAmount?: number,
  notes?: string,
  evidenceDocumentId?: string
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (actualAmount !== undefined) updatePayload.actual_amount = actualAmount;
    if (notes !== undefined) updatePayload.notes = notes;
    if (evidenceDocumentId !== undefined) updatePayload.evidence_document_id = evidenceDocumentId;

    if (status === 'FILED') updatePayload.filed_at = new Date().toISOString();
    if (status === 'PAID') updatePayload.paid_at = new Date().toISOString();

    const { error } = await supabase
      .from('tax_obligations')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'TAX_OBLIGATION_STATUS_UPDATED',
      entity_type: 'tax_obligations',
      entity_id: id,
      after_json: updatePayload,
      ip_or_context: `Estado de obligación actualizado a ${status}`,
    });

    revalidatePath('/obligations');
    revalidatePath('/taxes');
    revalidatePath('/dashboard');
    return { success: true, data: true, message: `Obligación tributaria marcada como ${status}.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves tax notifications and upcoming alerts.
 */
export async function getTaxNotificationsAction(): Promise<ActionResponse<TaxNotification[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    const { data, error } = await supabase
      .from('tax_notifications')
      .select(`
        *,
        tax_obligation:tax_obligations!tax_obligation_id(id, name, tax_type, due_date, estimated_amount, status)
      `)
      .eq('company_id', session.activeCompanyId)
      .order('scheduled_for', { ascending: true });

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Schedules a tax alert notification across configured channels (IN_APP, EMAIL, WHATSAPP, SLACK).
 * Reminders supported: 30d, 15d, 7d, 3d, 1d, due date, overdue.
 */
export async function scheduleTaxNotificationAction(
  obligationId: string,
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'SLACK',
  triggerType: 'DAYS_30' | 'DAYS_15' | 'DAYS_7' | 'DAYS_3' | 'DAYS_1' | 'DUE_DATE' | 'OVERDUE'
): Promise<ActionResponse<TaxNotification>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: obligation } = await supabase
      .from('tax_obligations')
      .select('id, name, due_date')
      .eq('id', obligationId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (!obligation) return { success: false, error: 'Obligación tributaria no encontrada.' };

    const dueDate = new Date(obligation.due_date);
    let offsetDays = 0;
    if (triggerType === 'DAYS_30') offsetDays = -30;
    else if (triggerType === 'DAYS_15') offsetDays = -15;
    else if (triggerType === 'DAYS_7') offsetDays = -7;
    else if (triggerType === 'DAYS_3') offsetDays = -3;
    else if (triggerType === 'DAYS_1') offsetDays = -1;
    else if (triggerType === 'DUE_DATE') offsetDays = 0;
    else if (triggerType === 'OVERDUE') offsetDays = 1;

    const scheduledDate = new Date(dueDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('tax_notifications')
      .insert({
        company_id: session.activeCompanyId,
        tax_obligation_id: obligationId,
        channel,
        trigger_type: triggerType,
        scheduled_for: scheduledDate.toISOString(),
        status: channel === 'IN_APP' ? 'PENDING' : 'PENDING',
        payload: {
          obligation_name: obligation.name,
          due_date: obligation.due_date,
          channel_status: channel === 'IN_APP' ? 'ACTIVE' : 'NOT_CONFIGURED',
        },
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

