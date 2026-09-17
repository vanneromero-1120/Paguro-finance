// ============================================================================
// Paguro Finance - Supabase Middleware Session Handler
// ============================================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const pathname = request.nextUrl.pathname;

  // List of protected enterprise application route prefixes
  const protectedPrefixes = [
    '/dashboard',
    '/sales',
    '/purchases',
    '/inventory',
    '/taxes',
    '/reports',
    '/documents',
    '/settings',
  ];

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  // If Supabase credentials are not provided (development / offline mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    // In local development mode without remote Supabase connected, check demo session cookie
    const demoSession = request.cookies.get('paguro_demo_session');
    if (isProtected && !demoSession) {
      // In offline mode, automatically allow navigation or redirect to /login
      // If user hasn't selected a persona, let them choose at /login
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // Configure Supabase SSR client for middleware
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() securely revalidates JWT authenticity with Supabase Auth servers
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protection guard
  if (isProtected && !user) {
    const demoSession = request.cookies.get('paguro_demo_session');
    if (!demoSession) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // If user is authenticated and attempts to access the login or forgot-password page, redirect to /dashboard
  if ((pathname === '/login' || pathname === '/forgot-password') && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
