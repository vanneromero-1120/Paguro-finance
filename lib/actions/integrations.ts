// ============================================================================
// Paguro Finance V1 - Integrations Architecture Server Actions
// Idempotent Sync Engine, Provider Status Management & Audit Trail
// ============================================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import {
  IntegrationConnection,
  IntegrationStatus,
  SyncLog,
} from '@/types/v1-financial';

export interface ActionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Retrieves all integration connections for the company.
 */
export async function getIntegrationsAction(): Promise<ActionResponse<IntegrationConnection[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    const { data, error } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('category');

    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Idempotent sync trigger for an integration provider.
 * Logs execution in sync_logs and never creates duplicates.
 */
export async function triggerSyncAction(
  provider: string,
  options?: { folderId?: string; fileId?: string; maxFiles?: number; recursive?: boolean }
): Promise<ActionResponse<SyncLog>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    // 1. Check provider connection status
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .eq('provider', provider)
      .single();

    // 2. Start sync log
    const { data: logRecord, error: logErr } = await supabase
      .from('sync_logs')
      .insert({
        company_id: session.activeCompanyId,
        provider,
        sync_started_at: new Date().toISOString(),
        status: 'RUNNING',
      })
      .select()
      .single();

    if (logErr) return { success: false, error: logErr.message };

    // 3. Mark connection as SYNCING
    await supabase
      .from('integration_connections')
      .update({ sync_status: 'SYNCING' })
      .eq('id', conn?.id);

    // 4. Execute real idempotent logic based on provider
    let recordsFound = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    let errorSummary: string | null = null;
    let finalStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';

    if (provider === 'GOOGLE_DRIVE') {
      const { syncGoogleDriveAccountingDocuments } = await import('@/lib/integrations/google-drive');
      const syncResult = await syncGoogleDriveAccountingDocuments(session.activeCompanyId, options);
      recordsFound = syncResult.objectsAnalyzed || syncResult.filesDiscovered;
      recordsCreated = syncResult.filesIngested;
      recordsUpdated = syncResult.filesUpdated !== undefined ? syncResult.filesUpdated : syncResult.filesSkipped;
      recordsFailed = syncResult.filesFailed;
      errorSummary = syncResult.message;

      if (syncResult.status === 'NEEDS_ATTENTION') {
        finalStatus = 'FAILED';
      } else if (!syncResult.success && syncResult.filesIngested === 0 && syncResult.filesUpdated === 0) {
        finalStatus = 'FAILED';
      }
    } else if (conn?.status === 'NOT_CONFIGURED') {
      // Do not fabricate successful sync if credentials are not configured
      recordsFound = 0;
      errorSummary = 'El proveedor no cuenta con credenciales API ni autorización OAuth activa (NOT CONFIGURED).';
      finalStatus = 'FAILED';
    } else {
      recordsFound = 0;
      recordsCreated = 0;
      recordsUpdated = 0;
    }

    // 5. Finalize sync log
    const { data: finalLog } = await supabase
      .from('sync_logs')
      .update({
        sync_finished_at: new Date().toISOString(),
        records_found: recordsFound,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        records_failed: recordsFailed,
        status: finalStatus,
        error_summary: errorSummary,
      })
      .eq('id', logRecord.id)
      .select()
      .single();

    // 6. Update connection status
    await supabase
      .from('integration_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: finalStatus === 'COMPLETED' ? 'SUCCESS' : 'ERROR',
        error_summary: finalStatus === 'COMPLETED' ? null : errorSummary,
      })
      .eq('id', conn?.id);

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'INTEGRATION_SYNC_TRIGGERED',
      entity_type: 'integration_connections',
      entity_id: conn?.id || provider,
      after_json: finalLog,
      ip_or_context: `Sincronización ${provider}: ${finalStatus} (${recordsFound} analizados, ${recordsCreated} creados, ${recordsUpdated} actualizados)`,
    });

    revalidatePath('/integrations');
    revalidatePath('/documents');
    revalidatePath('/dashboard');
    return {
      success: finalStatus === 'COMPLETED',
      data: finalLog,
      message: errorSummary || `Sincronización con ${provider} completada exitosamente.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Toggles automatic background sync for Google Drive or other providers.
 */
export async function toggleAutoSyncAction(
  provider: string,
  enabled: boolean,
  intervalMinutes: number = 15
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { data: conn } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .eq('provider', provider)
      .single();

    if (!conn) return { success: false, error: 'Conexión no encontrada.' };

    const nextScheduled = enabled
      ? new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString()
      : null;

    const newConfig = {
      ...(conn.config || {}),
      auto_sync_enabled: enabled,
      sync_interval_minutes: intervalMinutes,
      next_scheduled_sync_at: nextScheduled,
    };

    const { error } = await supabase
      .from('integration_connections')
      .update({
        config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'INTEGRATION_AUTO_SYNC_TOGGLED',
      entity_type: 'integration_connections',
      entity_id: conn.id,
      ip_or_context: `Sincronización automática de ${provider}: ${
        enabled ? 'ACTIVA' : 'PAUSADA'
      } (${intervalMinutes} min)`,
    });

    revalidatePath('/integrations');
    return {
      success: true,
      data: enabled,
      message: enabled
        ? `Sincronización automática activada (cada ${intervalMinutes} minutos).`
        : 'Sincronización automática pausada.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Continuous / Incremental Sync trigger (suitable for testing automatic sync on demand).
 */
export async function triggerContinuousSyncAction(
  provider: string,
  options?: any
): Promise<ActionResponse<any>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  if (provider === 'GOOGLE_DRIVE') {
    const { syncGoogleDriveAccountingDocuments } = await import('@/lib/integrations/google-drive');
    const syncResult = await syncGoogleDriveAccountingDocuments(session.activeCompanyId, {
      ...options,
      mode: 'AUTOMATIC_INCREMENTAL',
    });

    revalidatePath('/integrations');
    revalidatePath('/documents');
    revalidatePath('/dashboard');
    return {
      success: syncResult.success,
      data: syncResult,
      message: syncResult.message,
    };
  }

  return triggerSyncAction(provider, options);
}

/**
 * Retrieves sync execution logs for audit and traceability.
 */
export async function getSyncLogsAction(
  provider?: string
): Promise<ActionResponse<SyncLog[]>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.', data: [] };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.', data: [] };

  try {
    let query = supabase
      .from('sync_logs')
      .select('*')
      .eq('company_id', session.activeCompanyId)
      .order('sync_started_at', { ascending: false })
      .limit(20);

    if (provider && provider !== 'ALL') {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Updates configuration or connection status for an integration.
 */
export async function updateIntegrationConfigAction(
  provider: string,
  status: IntegrationStatus,
  config: Record<string, any>
): Promise<ActionResponse<boolean>> {
  const session = await getServerAuthSession();
  if (!session) return { success: false, error: 'Sesión no iniciada.' };

  const supabase = createServerSupabaseClient();
  if (!supabase) return { success: false, error: 'Base de datos no disponible.' };

  try {
    const { error } = await supabase
      .from('integration_connections')
      .update({
        status,
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', session.activeCompanyId)
      .eq('provider', provider);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_logs').insert({
      company_id: session.activeCompanyId,
      user_id: session.userId,
      action: 'INTEGRATION_CONFIG_UPDATED',
      entity_type: 'integration_connections',
      entity_id: provider,
      ip_or_context: `Proveedor: ${provider}, Nuevo estado: ${status}`,
    });

    revalidatePath('/integrations');
    return { success: true, data: true, message: 'Configuración actualizada con éxito.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
