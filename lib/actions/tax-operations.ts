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
  unverified_import_count: number;
  review_reasons: string[];
  disclaimer: string;
  is_profile_complete: boolean;
  value_statuses: {
    generated_iva: TaxReviewStatus;
    deductible_iva: TaxReviewStatus;
    withholding: TaxReviewStatus;
    ica: TaxReviewStatus;
    net_iva: TaxReviewStatus;
  };
}

import { isTaxProfileComplete } from '@/lib/finance/taxes';
export { isTaxProfileComplete };

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
      // Auto-initialize empty profile without unverified assumptions
      const { data: comp } = await supabase
        .from('companies')
        .select('legal_name, tax_id')
        .eq('id', session.activeCompanyId)
        .single();

      const currentYear = new Date().getFullYear();
      const { data: created } = await supabase
        .from('company_tax_profile')
        .insert({
          company_id: session.activeCompanyId,
          tax_id: comp?.tax_id || '',
          legal_name: comp?.legal_name || '',
          country: 'Colombia',
          city: '',
          municipality: '',
          tax_regime: '',
          rut_responsibilities: [],
          iva_responsible: false,
          income_tax_responsibility: false,
          withholding_agent: false,
          fiscal_year: currentYear,
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
 * Enforces tax safety: import transactions (Commercial Invoices) do NOT claim 19% deductible IVA
 * without verified customs/import evidence (DIAN Formulario 500).
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
    // 1. Fetch Tax Profile & assess completeness
    const { data: taxProfile } = await supabase
      .from('company_tax_profile')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .maybeSingle();

    const profileComplete = isTaxProfileComplete(taxProfile);

    // 2. Fetch Movements within range with attached documents
    let query = supabase
      .from('financial_movements')
      .select(`
        id,
        amount_cop,
        direction,
        currency,
        tax_relevance,
        tax_status,
        document_id,
        notes,
        document:documents!document_id(
          id,
          document_type,
          tax_iva,
          tax_withholding,
          pipeline_status,
          user_verified_fields
        )
      `)
      .eq('company_id', session.activeCompanyId);

    if (dateFrom) query = query.gte('movement_date', dateFrom);
    if (dateTo) query = query.lte('movement_date', dateTo);

    const { data: movements, error } = await query;
    if (error) return { success: false, error: error.message };

    let totalIncome = 0;
    let totalExpense = 0;
    let deductibleIva = 0;
    let unverifiedImportCount = 0;
    const reviewReasons: string[] = [];
    const count = (movements || []).length;

    (movements || []).forEach((m: any) => {
      const amount = Number(m.amount_cop) || 0;
      if (m.direction === 'INCOME') {
        totalIncome += amount;
      } else {
        totalExpense += amount;

        // Check if movement is an import or foreign currency transaction
        const doc = m.document;
        const isForeignCurrency = m.currency && m.currency !== 'COP';
        const isCommercialInvoice = doc?.document_type === 'COMMERCIAL_INVOICE';
        const isImportNote = (m.notes && m.notes.toLowerCase().includes('import')) || false;

        if (isCommercialInvoice || isForeignCurrency || isImportNote) {
          // CRITICAL TAX SAFETY:
          // Foreign commercial invoices alone do NOT prove Colombian deductible import IVA.
          // Requires official DIAN Formulario 500 (Declaración de Importación).
          unverifiedImportCount++;
          if (!reviewReasons.includes('IMPORT_WITHOUT_DIAN_DECLARATION')) {
            reviewReasons.push(
              'Operación de importación detectada (Factura comercial extranjera) sin Declaración de Importación oficial DIAN (Formulario 500). El IVA descontable queda en REQUIERE REVISIÓN y no se presume automáticamente.'
            );
          }
        } else if (taxProfile?.iva_responsible) {
          // Domestic purchase with IVA
          if (m.tax_relevance === 'TAXABLE' || !m.tax_relevance) {
            const docIva = doc?.tax_iva ? Number(doc.tax_iva) : 0;
            if (docIva > 0) {
              deductibleIva += docIva;
            } else {
              deductibleIva += Math.round(amount * 0.19 * 100) / 100;
            }
          }
        }
      }
    });

    const isIvaResponsible = taxProfile?.iva_responsible === true;
    const generatedIva = isIvaResponsible ? Math.round(totalIncome * 0.19 * 100) / 100 : 0;
    const netIva = generatedIva - deductibleIva;

    // Retefuente: Only apply if verified withholding agent
    const isWithholdingAgent = taxProfile?.withholding_agent === true;
    const withholdingTax = isWithholdingAgent ? Math.round(totalExpense * 0.035 * 100) / 100 : 0;

    // ICA on gross revenue
    const icaRate =
      taxProfile?.ica_configuration?.rate && typeof taxProfile.ica_configuration.rate === 'number'
        ? taxProfile.ica_configuration.rate
        : 0;
    const icaEstimated = Math.round(totalIncome * icaRate * 100) / 100;

    // Corporate income tax provision (35% corporate tax on estimated net profit before tax)
    const netOperating = Math.max(0, totalIncome - totalExpense);
    const incomeTaxProvision = Math.round(netOperating * 0.35 * 100) / 100;

    const totalLiabilities = Math.max(0, netIva) + withholdingTax + icaEstimated;

    // Determine status
    let globalStatus: TaxReviewStatus = 'ESTIMATED';
    if (!profileComplete) {
      globalStatus = 'REVIEW_REQUIRED';
      reviewReasons.unshift(
        'CONFIGURACIÓN TRIBUTARIA INCOMPLETA: Faltan datos esenciales (NIT, Régimen, Municipio, Responsabilidades RUT). Complete la configuración para liquidar obligaciones y retenciones.'
      );
    } else if (unverifiedImportCount > 0) {
      globalStatus = 'REVIEW_REQUIRED';
    }

    const valueStatuses = {
      generated_iva: !profileComplete ? ('REVIEW_REQUIRED' as TaxReviewStatus) : ('ESTIMATED' as TaxReviewStatus),
      deductible_iva:
        !profileComplete || unverifiedImportCount > 0
          ? ('REVIEW_REQUIRED' as TaxReviewStatus)
          : ('ESTIMATED' as TaxReviewStatus),
      withholding: !isWithholdingAgent ? ('REVIEW_REQUIRED' as TaxReviewStatus) : ('ESTIMATED' as TaxReviewStatus),
      ica: icaRate === 0 ? ('REVIEW_REQUIRED' as TaxReviewStatus) : ('ESTIMATED' as TaxReviewStatus),
      net_iva: globalStatus,
    };

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
        tax_status: globalStatus,
        transactions_analyzed: count,
        unverified_import_count: unverifiedImportCount,
        review_reasons: reviewReasons,
        is_profile_complete: profileComplete,
        value_statuses: valueStatuses,
        disclaimer: !profileComplete
          ? 'CONFIGURACIÓN TRIBUTARIA INCOMPLETA. Complete el perfil tributario para habilitar el cálculo de obligaciones.'
          : 'Información financiera de control gerencial. Las estimaciones aquí presentadas son referenciales y no constituyen una liquidación oficial ante la DIAN ni reemplazan la asesoría del contador público oficial.',
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

export interface InAppSystemNotification {
  id: string;
  type: 'DANGER' | 'WARNING' | 'INFO' | 'SUCCESS';
  title: string;
  message: string;
  category: 'TAX_OBLIGATION' | 'DOCUMENT_REVIEW' | 'INTEGRATION_STATE';
  timestamp: string;
  href: string;
}

/**
 * Retrieves internal in-app system notifications:
 * - Tax obligations due in 7 days, 3 days, today, or overdue
 * - Documents requiring human review or in conflict
 * - Google Drive integration state / attention required
 */
export async function getInAppSystemNotificationsAction(): Promise<ActionResponse<InAppSystemNotification[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    const notifications: InAppSystemNotification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check Tax Obligations (due in 7d, 3d, today, or overdue)
    const { data: obligations } = await supabase
      .from('tax_obligations')
      .select('id, name, due_date, status, estimated_amount')
      .eq('company_id', session.activeCompanyId)
      .not('status', 'in', '("PAID","FILED","NOT_APPLICABLE")');

    (obligations || []).forEach((o) => {
      const dueDate = new Date(o.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

      if (diffDays < 0) {
        notifications.push({
          id: `ob-overdue-${o.id}`,
          type: 'DANGER',
          title: 'Obligación Tributaria Vencida',
          message: `${o.name} venció hace ${Math.abs(diffDays)} día(s) (Fecha límite: ${o.due_date}).`,
          category: 'TAX_OBLIGATION',
          timestamp: new Date().toISOString(),
          href: '/obligations',
        });
      } else if (diffDays === 0) {
        notifications.push({
          id: `ob-today-${o.id}`,
          type: 'DANGER',
          title: 'Obligación Vence Hoy',
          message: `${o.name} vence hoy. Verifique la presentación y comprobante de pago.`,
          category: 'TAX_OBLIGATION',
          timestamp: new Date().toISOString(),
          href: '/obligations',
        });
      } else if (diffDays <= 3) {
        notifications.push({
          id: `ob-soon-${o.id}`,
          type: 'WARNING',
          title: 'Obligación Vence en 3 Días o Menos',
          message: `${o.name} vence en ${diffDays} día(s) (${o.due_date}).`,
          category: 'TAX_OBLIGATION',
          timestamp: new Date().toISOString(),
          href: '/obligations',
        });
      } else if (diffDays <= 7) {
        notifications.push({
          id: `ob-upcoming-${o.id}`,
          type: 'INFO',
          title: 'Obligación Próxima a Vencer (7 Días)',
          message: `${o.name} tiene vencimiento programado para el ${o.due_date}.`,
          category: 'TAX_OBLIGATION',
          timestamp: new Date().toISOString(),
          href: '/obligations',
        });
      }
    });

    // 2. Check Documents Requiring Human Review or in Conflict
    const { count: reviewCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', session.activeCompanyId)
      .eq('pipeline_status', 'REQUIRES_REVIEW');

    if (reviewCount && reviewCount > 0) {
      notifications.push({
        id: 'docs-review-needed',
        type: 'WARNING',
        title: 'Documentos Pendientes de Revisión',
        message: `${reviewCount} documento(s) contable(s) en cola de revisión humana.`,
        category: 'DOCUMENT_REVIEW',
        timestamp: new Date().toISOString(),
        href: '/documents',
      });
    }

    const { count: conflictCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', session.activeCompanyId)
      .eq('source_status', 'CONFLICT');

    if (conflictCount && conflictCount > 0) {
      notifications.push({
        id: 'docs-conflict-needed',
        type: 'DANGER',
        title: 'Conflicto de Fuente Google Drive',
        message: `${conflictCount} documento(s) cambiaron en Google Drive tras verificación humana.`,
        category: 'DOCUMENT_REVIEW',
        timestamp: new Date().toISOString(),
        href: '/documents',
      });
    }

    // 3. Check Google Drive Integration Status
    const { data: driveConn } = await supabase
      .from('integration_connections')
      .select('status, error_summary')
      .eq('company_id', session.activeCompanyId)
      .eq('provider', 'GOOGLE_DRIVE')
      .maybeSingle();

    if (driveConn?.status === 'NEEDS_ATTENTION') {
      notifications.push({
        id: 'drive-needs-attention',
        type: 'DANGER',
        title: 'Google Drive Requiere Atención',
        message: driveConn.error_summary || 'El token de acceso expiró o falló la sincronización automática.',
        category: 'INTEGRATION_STATE',
        timestamp: new Date().toISOString(),
        href: '/integrations',
      });
    }

    return { success: true, data: notifications };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

