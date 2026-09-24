// ============================================================================
// Paguro Finance - Server-Side Authorization Utilities
// ============================================================================

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AuthUser, Permission } from '@/types/auth';
import { UserRole } from '@/types/database';
import { hasPermission } from '@/lib/auth/permissions';

/**
 * Returns the currently authenticated user with profile and company memberships from live Supabase.
 */
export async function getServerAuthSession(): Promise<AuthUser | null> {
  const cookieStore = cookies();
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    // 1. Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // 2. Fetch company memberships with associated company records
    const { data: memberships } = await supabase
      .from('company_users')
      .select('company_id, role, status, companies (*)')
      .eq('user_id', user.id)
      .in('status', ['active', 'ACTIVE']);

    const companiesList = (memberships || [])
      .filter((m: any) => m.companies && (m.status === 'active' || m.status === 'ACTIVE'))
      .map((m: any) => ({
        company: m.companies,
        role: m.role as UserRole,
      }));

    // 3. Determine active company from cookie or first available company
    const activeCompanyCookie = cookieStore.get('paguro_active_company')?.value;
    const activeCompanyMembership =
      companiesList.find((c: any) => c.company.id === activeCompanyCookie) || companiesList[0];

    if (profile && activeCompanyMembership) {
      return {
        id: user.id,
        userId: user.id,
        email: user.email || profile.email,
        profile: profile,
        companies: companiesList,
        activeCompanyId: activeCompanyMembership.company.id,
        activeRole: activeCompanyMembership.role,
        role: activeCompanyMembership.role,
      };
    }

    return null;
  } catch (err: any) {
    console.error('[getServerAuthSession] Authentication lookup error:', err);
    return null;
  }
}

/**
 * Ensures user is authenticated. If not, immediately redirects to /login with returnTo query.
 */
export async function requireAuthSession(returnTo?: string): Promise<AuthUser> {
  const session = await getServerAuthSession();
  if (!session) {
    const target = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return session;
}

/**
 * Ensures user possesses one of the allowed roles for the active company.
 * If unauthorized, redirects to /unauthorized.
 */
export async function requireCompanyRole(
  allowedRoles: UserRole[],
  companyId?: string
): Promise<AuthUser> {
  const session = await requireAuthSession();

  const targetCompanyId = companyId || session.activeCompanyId;
  const membership = session.companies.find((c) => c.company.id === targetCompanyId);

  if (!membership) {
    redirect(`/unauthorized?reason=no_membership&company=${targetCompanyId}`);
  }

  if (session.activeRole === 'SUPER_ADMIN') {
    return session;
  }

  if (!allowedRoles.includes(membership.role)) {
    redirect(`/unauthorized?reason=insufficient_role&required=${allowedRoles.join(',')}&current=${membership.role}`);
  }

  return session;
}

/**
 * Ensures user possesses a specific granular RBAC permission.
 * If unauthorized, redirects to /unauthorized.
 */
export async function requirePermission(
  permission: Permission,
  companyId?: string
): Promise<AuthUser> {
  const session = await requireAuthSession();

  const targetCompanyId = companyId || session.activeCompanyId;
  const membership = session.companies.find((c) => c.company.id === targetCompanyId);

  if (!membership) {
    redirect(`/unauthorized?reason=no_membership&company=${targetCompanyId}`);
  }

  const role = membership.role;
  if (!hasPermission(role, permission)) {
    redirect(`/unauthorized?reason=permission_denied&permission=${permission}&role=${role}`);
  }

  return session;
}
