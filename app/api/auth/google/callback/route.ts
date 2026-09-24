// ============================================================================
// Paguro Finance V1 - Google OAuth Callback Route
// Receives authorization code, exchanges for tokens, updates integration status
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { exchangeGoogleAuthCode } from '@/lib/integrations/google-drive';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateCompanyId = searchParams.get('state');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(`Google declinó el acceso: ${error}`)}`, baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/integrations?error=missing_code', baseUrl)
    );
  }

  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login?error=session_expired', baseUrl));
  }

  const targetCompanyId = stateCompanyId || session.activeCompanyId;
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(new URL('/integrations?error=database_unavailable', baseUrl));
  }

  try {
    const tokens = await exchangeGoogleAuthCode(code);

    // Save tokens in integration_connections
    const { error: updateErr } = await supabase
      .from('integration_connections')
      .update({
        status: 'CONNECTED',
        sync_status: 'IDLE',
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          token_type: tokens.token_type,
          authorized_by: session.userId,
        },
        error_summary: null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', targetCompanyId)
      .eq('provider', 'GOOGLE_DRIVE');

    if (updateErr) {
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(updateErr.message)}`, baseUrl)
      );
    }

    // Record audit log
    await supabase.from('audit_logs').insert({
      company_id: targetCompanyId,
      user_id: session.userId,
      action: 'INTEGRATION_CONNECTED',
      entity_type: 'integration_connections',
      entity_id: 'GOOGLE_DRIVE',
      ip_or_context: 'Google Drive conectado exitosamente con permisos de lectura.',
    });

    return NextResponse.redirect(new URL('/integrations?success=google_connected', baseUrl));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(err.message || 'Error procesando tokens')}`, baseUrl)
    );
  }
}
