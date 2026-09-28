// ============================================================================
// Paguro Finance V1 - Production Scheduled Google Drive Continuous Sync
// Vercel Cron & Supabase Scheduled Job Endpoint
// Executes incremental synchronization every 15 minutes for connected companies
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { syncGoogleDriveAccountingDocuments } from '@/lib/integrations/google-drive';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution time for cron

export async function GET(request: NextRequest) {
  return handleSyncCron(request);
}

export async function POST(request: NextRequest) {
  return handleSyncCron(request);
}

async function handleSyncCron(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === 'development';

  // Security Check: CRON_SECRET enforcement
  if (!cronSecret) {
    if (!isDev) {
      console.error('[DriveSyncCron] CRON_SECRET is not configured in production environment.');
      return NextResponse.json(
        { error: 'Server misconfiguration: CRON_SECRET is required in production.' },
        { status: 500 }
      );
    }
  } else {
    // Production authentication strictly requires Authorization: Bearer <CRON_SECRET>
    // URL query parameters (?secret=, ?key=) are explicitly rejected in production to prevent leakage in logs/caches
    const bearerExpected = `Bearer ${cronSecret}`;
    const isBearerValid = authHeader === bearerExpected;

    // Optional localhost development override: only allowed if explicitly NODE_ENV === 'development'
    const isDevAuthorized = isDev && request.nextUrl.searchParams.get('dev_bypass') === 'true';

    if (!isBearerValid && !isDevAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or missing cron authentication token' },
        { status: 401 }
      );
    }
  }

  // Use resilient Supabase client
  const supabase = createAdminClient() || createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  try {
    // 1. Fetch all companies with Google Drive connected
    const { data: connections, error: fetchErr } = await supabase
      .from('integration_connections')
      .select('*')
      .eq('provider', 'GOOGLE_DRIVE')
      .eq('status', 'CONNECTED');

    if (fetchErr) {
      return NextResponse.json(
        { error: `Error querying integration connections: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No companies found with active Google Drive connections.',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const results = [];

    // 2. Execute incremental sync for each company
    for (const conn of connections) {
      const companyId = conn.company_id;
      const config = conn.config || {};

      // Check if automatic sync is paused for this company
      if (config.auto_sync_enabled === false) {
        results.push({
          companyId,
          status: 'PAUSED',
          message: 'Automatic synchronization is paused in company settings.',
        });
        continue;
      }

      // Check if scheduled interval has elapsed (fallback safeguard)
      const lastSync = conn.last_sync_at ? new Date(conn.last_sync_at).getTime() : 0;
      const intervalMinutes = config.sync_interval_minutes || 15;
      const intervalMs = intervalMinutes * 60 * 1000;
      const forceSync = request.nextUrl.searchParams.get('force') === 'true';

      // If called from scheduled cron and not forced, only process if interval reached or first sync
      if (!forceSync && lastSync && Date.now() - lastSync < intervalMs - 30000) {
        results.push({
          companyId,
          status: 'SKIPPED_NOT_DUE',
          message: `Last sync was ${Math.round(
            (Date.now() - lastSync) / 60000
          )}m ago. Scheduled interval is ${intervalMinutes}m.`,
        });
        continue;
      }

      // Execute continuous incremental sync
      const syncResult = await syncGoogleDriveAccountingDocuments(companyId, {
        mode: 'AUTOMATIC_INCREMENTAL',
      });

      // Record in sync_logs
      await supabase.from('sync_logs').insert({
        company_id: companyId,
        provider: 'GOOGLE_DRIVE',
        sync_started_at: new Date().toISOString(),
        sync_finished_at: new Date().toISOString(),
        records_found: syncResult.objectsAnalyzed,
        records_created: syncResult.filesIngested,
        records_updated: syncResult.filesUpdated,
        records_failed: syncResult.filesFailed,
        status: syncResult.success ? 'COMPLETED' : 'FAILED',
        error_summary: syncResult.message,
      });

      results.push({
        companyId,
        status: syncResult.status,
        success: syncResult.success,
        ingested: syncResult.filesIngested,
        updated: syncResult.filesUpdated,
        skipped: syncResult.filesSkipped,
        missing: syncResult.filesMissing,
        requiringReview: syncResult.filesRequiringReview,
        message: syncResult.message,
      });
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[DriveSyncCron] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error executing drive sync cron' },
      { status: 500 }
    );
  }
}
