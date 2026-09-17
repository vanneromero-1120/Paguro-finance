// ============================================================================
// Paguro Finance - Customer Server Actions
// Production-safe data access, RLS enforcement, and immutable audit logging
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { Customer, CreateCustomerInput, UpdateCustomerInput } from '@/types/database';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'];

/**
 * Retrieves all customers for the user's active authorized company.
 */
export async function getCustomersAction(
  search?: string,
  statusFilter?: string
): Promise<ActionResponse<Customer[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no configurado.', data: [] };
  }

  try {
    let query = supabase
      .from('customers')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(
        `name.ilike.%${term}%,legal_name.ilike.%${term}%,tax_id.ilike.%${term}%,email.ilike.%${term}%,city.ilike.%${term}%`
      );
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[getCustomersAction] Query error:', error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: (data as Customer[]) || [] };
  } catch (err: any) {
    console.error('[getCustomersAction] Unexpected exception:', err);
    return { success: false, error: err?.message || 'Error al obtener clientes.', data: [] };
  }
}

/**
 * Creates a new customer under the user's active company with audit trail logging.
 */
export async function createCustomerAction(
  input: CreateCustomerInput
): Promise<ActionResponse<Customer>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Administrador o Finanzas para crear clientes.',
    };
  }

  if (!input.name || !input.name.trim()) {
    return { success: false, error: 'El nombre comercial del cliente es obligatorio.' };
  }

  if (!input.tax_id || !input.tax_id.trim()) {
    return { success: false, error: 'El número de identificación fiscal (NIT / Documento) es obligatorio.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Conexión con el servidor no disponible.' };
  }

  try {
    const payload = {
      company_id: session.activeCompanyId,
      name: input.name.trim(),
      legal_name: input.legal_name?.trim() || input.name.trim(),
      identification_type: input.identification_type?.trim() || 'NIT',
      tax_id: input.tax_id.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      billing_address: input.billing_address?.trim() || null,
      city: input.city?.trim() || null,
      country: input.country?.trim() || 'Colombia',
      payment_terms_days: Math.max(0, Number(input.payment_terms_days) || 30),
      notes: input.notes?.trim() || null,
      status: input.status || 'active',
      created_by: session.id,
    };

    const { data: customer, error: insertError } = await supabase
      .from('customers')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return {
          success: false,
          error: `Ya existe un cliente registrado con la identificación ${input.tax_id} en esta empresa.`,
        };
      }
      return { success: false, error: insertError.message };
    }

    // Append to immutable audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'CREATE',
      entity_type: 'customer',
      entity_id: customer.id,
      after_json: customer,
    });

    return { success: true, data: customer as Customer, message: 'Cliente creado exitosamente.' };
  } catch (err: any) {
    console.error('[createCustomerAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al guardar el cliente.' };
  }
}

/**
 * Updates an existing customer with validation and audit diff logging.
 */
export async function updateCustomerAction(
  id: string,
  input: UpdateCustomerInput
): Promise<ActionResponse<Customer>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Se requiere rol de Administrador o Finanzas para editar clientes.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Conexión con el servidor no disponible.' };
  }

  try {
    // 1. Fetch current state for audit diff
    const { data: beforeCustomer, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchError || !beforeCustomer) {
      return { success: false, error: 'El cliente no existe o pertenece a otra empresa.' };
    }

    const payload: Partial<Customer> = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.legal_name !== undefined) payload.legal_name = input.legal_name?.trim() || null;
    if (input.identification_type !== undefined) payload.identification_type = input.identification_type.trim();
    if (input.tax_id !== undefined) payload.tax_id = input.tax_id.trim();
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.billing_address !== undefined) payload.billing_address = input.billing_address?.trim() || null;
    if (input.city !== undefined) payload.city = input.city?.trim() || null;
    if (input.country !== undefined) payload.country = input.country?.trim() || 'Colombia';
    if (input.payment_terms_days !== undefined) payload.payment_terms_days = Math.max(0, Number(input.payment_terms_days));
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.status !== undefined) payload.status = input.status;

    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select('*')
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        return {
          success: false,
          error: `Ya existe otro cliente con el número de identificación indicado.`,
        };
      }
      return { success: false, error: updateError.message };
    }

    // Append to immutable audit log
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'UPDATE',
      entity_type: 'customer',
      entity_id: id,
      before_json: beforeCustomer,
      after_json: updatedCustomer,
    });

    return { success: true, data: updatedCustomer as Customer, message: 'Cliente actualizado exitosamente.' };
  } catch (err: any) {
    console.error('[updateCustomerAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar el cliente.' };
  }
}

/**
 * Toggles a customer between active and inactive states (soft archiving).
 */
export async function toggleCustomerStatusAction(
  id: string,
  newStatus: 'active' | 'inactive'
): Promise<ActionResponse<Customer>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!WRITE_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado para modificar el estado del cliente.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Conexión con el servidor no disponible.' };
  }

  try {
    const { data: beforeCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (!beforeCustomer) {
      return { success: false, error: 'Cliente no encontrado.' };
    }

    const { data: updatedCustomer, error } = await supabase
      .from('customers')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('company_id', session.activeCompanyId)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: newStatus === 'inactive' ? 'ARCHIVE' : 'ACTIVATE',
      entity_type: 'customer',
      entity_id: id,
      before_json: beforeCustomer,
      after_json: updatedCustomer,
    });

    return {
      success: true,
      data: updatedCustomer as Customer,
      message: `Cliente ${newStatus === 'active' ? 'activado' : 'desactivado'} exitosamente.`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al cambiar el estado del cliente.' };
  }
}
