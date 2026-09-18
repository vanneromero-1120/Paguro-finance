// ============================================================================
// Paguro Finance - Audit Server Actions
// Read-only, append-only immutable audit trail access with multi-company isolation
// ============================================================================

'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { AuditLog, AuditLogFilterInput } from '@/types/database';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
}

export interface EnrichedAuditLog extends AuditLog {
  user_email?: string;
  user_name?: string;
}

/**
 * Retrieves immutable audit log records for the active company.
 * Read-only interface with rich filtering and user enrichment.
 */
export async function getAuditLogsAction(
  filters?: AuditLogFilterInput
): Promise<ActionResponse<EnrichedAuditLog[]>> {
  const session = await getServerAuthSession();
  if (!session) {
    return { success: false, error: 'Sesión no iniciada.', data: [] };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Cliente de base de datos no disponible.', data: [] };
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('company_id', session.activeCompanyId);

    if (filters?.action && filters.action !== 'all') {
      query = query.eq('action', filters.action);
    }

    if (filters?.entityType && filters.entityType !== 'all') {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
    }

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(
        `action.ilike.%${term}%,entity_type.ilike.%${term}%,entity_id.ilike.%${term}%`
      );
    }

    const limit = Math.min(Math.max(1, filters?.limit || 100), 200);
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data: logs, error } = await query;

    if (error) {
      console.error('[getAuditLogsAction] Query error:', error);
      return { success: false, error: error.message, data: [] };
    }

    // Fetch user profiles to enrich logs with human-readable names and emails
    const userIds = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean)));
    const userMap: Record<string, { email: string; full_name: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      (profiles || []).forEach((p: any) => {
        userMap[p.id] = {
          email: p.email,
          full_name: p.full_name || p.email,
        };
      });
    }

    const enriched: EnrichedAuditLog[] = (logs || []).map((log: any) => ({
      ...log,
      user_email: userMap[log.user_id]?.email || log.user_id || 'Sistema',
      user_name: userMap[log.user_id]?.full_name || 'Sistema / Automático',
    }));

    return {
      success: true,
      data: enriched,
      total: enriched.length,
    };
  } catch (err: any) {
    console.error('[getAuditLogsAction] Exception:', err);
    return { success: false, error: err?.message || 'Error al obtener bitácora de auditoría.', data: [] };
  }
}
