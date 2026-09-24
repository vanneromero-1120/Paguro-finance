// ============================================================================
// Paguro Finance V1 - Google OAuth Authorization Route
// Initiates Google OAuth consent screen for Drive document ingestion
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth/server-auth';
import { getGoogleOAuthUrl } from '@/lib/integrations/google-drive';

export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  }

  // Permission check: VIEWER cannot authorize integrations
  if (session.role === 'VIEWER') {
    return NextResponse.redirect(new URL('/integrations?error=insufficient_permissions', request.url));
  }

  try {
    const authUrl = getGoogleOAuthUrl(session.activeCompanyId);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(err.message || 'Error iniciando OAuth')}`, request.url)
    );
  }
}
