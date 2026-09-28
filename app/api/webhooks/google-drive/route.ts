// ============================================================================
// Paguro Finance V1 - Google Drive Push Notification Webhook Receiver
// Handles Google Drive Changes Notifications (watch channel)
// Triggers instant incremental sync upon push event
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { syncGoogleDriveAccountingDocuments } from '@/lib/integrations/google-drive';

export async function POST(request: NextRequest) {
  // Google Drive sends state in headers:
  // X-Goog-Channel-ID, X-Goog-Resource-ID, X-Goog-Resource-State ('sync', 'add', 'update', 'trash', etc.)
  const channelId = request.headers.get('x-goog-channel-id');
  const resourceState = request.headers.get('x-goog-resource-state');
  const resourceId = request.headers.get('x-goog-resource-id');

  // Initial channel handshake from Google
  if (resourceState === 'sync') {
    return NextResponse.json({ success: true, message: 'Channel handshake confirmed' });
  }

  const supabase = createAdminClient() || createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    // Find connection by channel_id or match active Google Drive connection
    let query = supabase
      .from('integration_connections')
      .select('*')
      .eq('provider', 'GOOGLE_DRIVE')
      .eq('status', 'CONNECTED');

    const { data: connections } = await query;

    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: 'No connected company found for webhook' });
    }

    // Trigger incremental sync for affected connection
    for (const conn of connections) {
      if (conn.config?.auto_sync_enabled !== false) {
        await syncGoogleDriveAccountingDocuments(conn.company_id, {
          mode: 'AUTOMATIC_INCREMENTAL',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Incremental sync triggered via Google Drive push event',
      resourceState,
      channelId,
    });
  } catch (err: any) {
    console.error('[GoogleDriveWebhook] Error processing event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
