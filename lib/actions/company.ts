// ============================================================================
// Paguro Finance - Company Server Actions
// Multi-company isolation, RLS enforcement, and immutable audit logging
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { Company, UpdateCompanyInput } from '@/types/database';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/**
 * Retrieves company details for the active authenticated session.
 */
export async function getCompanyDetailsAction(): Promise<ActionResponse<Company>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', session.activeCompanyId)
      .single();

    if (error) {
      console.error('[getCompanyDetailsAction] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: company as Company };
  } catch (err: any) {
    console.error('[getCompanyDetailsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener datos de la empresa.' };
  }
}

/**
 * Updates company profile details with audit logging and RBAC enforcement.
 * Only SUPER_ADMIN and ADMIN are permitted to modify company records.
 */
export async function updateCompanyAction(
  input: UpdateCompanyInput
): Promise<ActionResponse<Company>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!ADMIN_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Administrador o Super Administrador para editar la configuración de la empresa.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Fetch current state for audit trail diff
    const { data: currentCompany, error: fetchErr } = await supabase
      .from('companies')
      .select('*')
      .eq('id', session.activeCompanyId)
      .single();

    if (fetchErr || !currentCompany) {
      return { success: false, error: 'No se encontró la empresa activa para actualizar.' };
    }

    // 2. Prepare sanitized update payload
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.legal_name !== undefined) updatePayload.legal_name = input.legal_name.trim();
    if (input.trade_name !== undefined) updatePayload.trade_name = input.trade_name.trim();
    if (input.tax_id !== undefined) updatePayload.tax_id = input.tax_id.trim();
    if (input.country_code !== undefined) updatePayload.country_code = input.country_code.trim();
    if (input.currency_code !== undefined) updatePayload.currency_code = input.currency_code.trim();
    if (input.timezone !== undefined) updatePayload.timezone = input.timezone.trim();
    if (input.email !== undefined) updatePayload.email = input.email?.trim() || null;
    if (input.phone !== undefined) updatePayload.phone = input.phone?.trim() || null;
    if (input.address !== undefined) updatePayload.address = input.address?.trim() || null;
    if (input.city !== undefined) updatePayload.city = input.city?.trim() || null;

    // 3. Execute update
    const { data: updatedCompany, error: updateErr } = await supabase
      .from('companies')
      .update(updatePayload)
      .eq('id', session.activeCompanyId)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[updateCompanyAction] Error updating company:', updateErr);
      return { success: false, error: updateErr.message };
    }

    // 4. Log in immutable audit trail
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'UPDATE',
      entity_type: 'company',
      entity_id: session.activeCompanyId,
      before_json: currentCompany,
      after_json: updatedCompany,
    });

    return {
      success: true,
      data: updatedCompany as Company,
      message: 'Configuración de la empresa actualizada correctamente.',
    };
  } catch (err: any) {
    console.error('[updateCompanyAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar la empresa.' };
  }
}
