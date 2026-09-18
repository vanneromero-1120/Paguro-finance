// ============================================================================
// Paguro Finance - Users & Roles Server Actions
// Strict RBAC, self-escalation prevention, company isolation, and audit trail
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { UserRole, CompanyUserMembershipWithProfile } from '@/types/database';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN'];
const VALID_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'ACCOUNTANT', 'OPERATIONS', 'VIEWER'];

/**
 * Retrieves all registered users and their roles for the active company.
 */
export async function getCompanyUsersAction(): Promise<ActionResponse<CompanyUserMembershipWithProfile[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    const { data: users, error } = await supabase
      .from('company_users')
      .select(`
        id,
        user_id,
        company_id,
        role,
        status,
        invited_at,
        last_access_at,
        profile:profiles (
          id,
          email,
          full_name,
          phone,
          avatar_url
        )
      `)
      .eq('company_id', session.activeCompanyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[getCompanyUsersAction] Error:', error);
      return { success: false, error: error.message, data: [] };
    }

    const formatted: CompanyUserMembershipWithProfile[] = (users || []).map((u: any) => ({
      id: u.id,
      user_id: u.user_id,
      company_id: u.company_id,
      role: u.role as UserRole,
      status: u.status as 'active' | 'invited' | 'suspended',
      invited_at: u.invited_at,
      last_access_at: u.last_access_at,
      profile: {
        id: u.profile?.id || u.user_id,
        email: u.profile?.email || 'Desconocido',
        full_name: u.profile?.full_name || 'Usuario',
        phone: u.profile?.phone || null,
        avatar_url: u.profile?.avatar_url || null,
      },
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    console.error('[getCompanyUsersAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener usuarios.', data: [] };
  }
}

/**
 * Updates a user's role within the company.
 * Enforces anti-self-escalation and role hierarchy security controls.
 */
export async function updateUserRoleAction(
  companyUserId: string,
  targetUserId: string,
  newRole: UserRole
): Promise<ActionResponse> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  // 1. Check caller permissions
  if (!ADMIN_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo administradores pueden modificar roles.',
    };
  }

  // 2. Prevent self-escalation / self-modification of roles
  if (session.id === targetUserId) {
    return {
      success: false,
      error: 'Operación prohibida: Por seguridad, no puede alterar su propio rol en el sistema.',
    };
  }

  // 3. Validate requested role
  if (!VALID_ROLES.includes(newRole)) {
    return { success: false, error: `Rol inválido: ${newRole}` };
  }

  // 4. Role privilege hierarchy: Only SUPER_ADMIN can grant or revoke SUPER_ADMIN
  if (newRole === 'SUPER_ADMIN' && session.activeRole !== 'SUPER_ADMIN') {
    return {
      success: false,
      error: 'Permiso denegado. Solo un Super Administrador puede asignar el rol de Super Administrador.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 5. Fetch target user's current membership record
    const { data: currentMember, error: fetchErr } = await supabase
      .from('company_users')
      .select('*')
      .eq('id', companyUserId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !currentMember) {
      return { success: false, error: 'Membresía de usuario no encontrada en esta empresa.' };
    }

    // Only SUPER_ADMIN can demote another SUPER_ADMIN
    if (currentMember.role === 'SUPER_ADMIN' && session.activeRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Permiso denegado. No puede modificar los permisos de un Super Administrador.',
      };
    }

    // Ensure company never loses its last SUPER_ADMIN
    if (currentMember.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const { count: superAdminCount } = await supabase
        .from('company_users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', session.activeCompanyId)
        .eq('role', 'SUPER_ADMIN')
        .eq('status', 'active');

      if ((superAdminCount || 0) <= 1) {
        return {
          success: false,
          error: 'Operación denegada. La empresa debe mantener al menos un Super Administrador activo.',
        };
      }
    }

    // 6. Update role
    const { data: updatedMember, error: updateErr } = await supabase
      .from('company_users')
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyUserId)
      .select('*')
      .single();

    if (updateErr) {
      console.error('[updateUserRoleAction] Update error:', updateErr);
      return { success: false, error: updateErr.message };
    }

    // 7. Append to audit trail
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'ROLE_CHANGE',
      entity_type: 'company_user',
      entity_id: companyUserId,
      before_json: currentMember,
      after_json: updatedMember,
    });

    return {
      success: true,
      message: `Rol actualizado correctamente a ${newRole}.`,
    };
  } catch (err: any) {
    console.error('[updateUserRoleAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al actualizar el rol del usuario.' };
  }
}

/**
 * Suspends or reactivates a user's membership in the company.
 */
export async function updateUserStatusAction(
  companyUserId: string,
  targetUserId: string,
  newStatus: 'active' | 'suspended'
): Promise<ActionResponse> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!ADMIN_ROLES.includes(session.activeRole)) {
    return {
      success: false,
      error: 'Permiso denegado. Solo administradores pueden gestionar el estado de los usuarios.',
    };
  }

  // Prevent self-suspension
  if (session.id === targetUserId) {
    return {
      success: false,
      error: 'Operación prohibida: No puede suspender su propia cuenta de acceso.',
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    const { data: currentMember, error: fetchErr } = await supabase
      .from('company_users')
      .select('*')
      .eq('id', companyUserId)
      .eq('company_id', session.activeCompanyId)
      .single();

    if (fetchErr || !currentMember) {
      return { success: false, error: 'Usuario no encontrado en la empresa.' };
    }

    // Cannot suspend SUPER_ADMIN unless caller is SUPER_ADMIN
    if (currentMember.role === 'SUPER_ADMIN' && session.activeRole !== 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Permiso denegado. No puede suspender a un Super Administrador.',
      };
    }

    // Prevent suspending the last active SUPER_ADMIN
    if (currentMember.role === 'SUPER_ADMIN' && newStatus === 'suspended') {
      const { count: superAdminCount } = await supabase
        .from('company_users')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', session.activeCompanyId)
        .eq('role', 'SUPER_ADMIN')
        .eq('status', 'active');

      if ((superAdminCount || 0) <= 1) {
        return {
          success: false,
          error: 'Operación denegada: Debe existir al menos un Super Administrador activo.',
        };
      }
    }

    const { data: updatedMember, error: updateErr } = await supabase
      .from('company_users')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyUserId)
      .select('*')
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Append to audit trail
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'STATUS_CHANGE',
      entity_type: 'company_user',
      entity_id: companyUserId,
      before_json: currentMember,
      after_json: updatedMember,
    });

    return {
      success: true,
      message: `Estado de membresía actualizado a: ${newStatus === 'active' ? 'Activo' : 'Suspendido'}.`,
    };
  } catch (err: any) {
    console.error('[updateUserStatusAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al cambiar el estado del usuario.' };
  }
}

/**
 * Adds an existing profile to the active company or sends membership invitation.
 */
export async function inviteCompanyUserAction(
  email: string,
  role: UserRole
): Promise<ActionResponse> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.' };
  }

  if (!ADMIN_ROLES.includes(session.activeRole)) {
    return { success: false, error: 'Permiso denegado. Se requiere rol administrativo.' };
  }

  if (role === 'SUPER_ADMIN' && session.activeRole !== 'SUPER_ADMIN') {
    return {
      success: false,
      error: 'Permiso denegado. Solo un Super Administrador puede invitar con rol de Super Administrador.',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Ingrese un correo electrónico válido.' };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.' };
  }

  try {
    // 1. Search for profile by email
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (!profile) {
      return {
        success: false,
        error: `El usuario con correo ${cleanEmail} aún no está registrado en el sistema. Debe registrarse o iniciar sesión primero.`,
      };
    }

    // 2. Check if user is already a member
    const { data: existingMember } = await supabase
      .from('company_users')
      .select('id, status, role')
      .eq('company_id', session.activeCompanyId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existingMember) {
      return {
        success: false,
        error: `El usuario ya pertenece a esta empresa con rol ${existingMember.role} (${existingMember.status}).`,
      };
    }

    // 3. Add membership
    const { data: newMembership, error: insertErr } = await supabase
      .from('company_users')
      .insert({
        company_id: session.activeCompanyId,
        user_id: profile.id,
        role: role,
        status: 'active',
        invited_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertErr) {
      console.error('[inviteCompanyUserAction] Insert error:', insertErr);
      return { success: false, error: insertErr.message };
    }

    // 4. Audit trail
    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.id,
      action: 'INVITE_USER',
      entity_type: 'company_user',
      entity_id: newMembership.id,
      after_json: newMembership,
    });

    return {
      success: true,
      message: `Usuario ${profile.full_name || cleanEmail} agregado exitosamente a la empresa.`,
    };
  } catch (err: any) {
    console.error('[inviteCompanyUserAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al agregar el usuario.' };
  }
}
