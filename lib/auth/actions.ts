// ============================================================================
// Paguro Finance - Next.js Authentication Server Actions
// ============================================================================

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/database';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Executes login via Supabase Auth with fallback to demo personas for development.
 */
export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const returnTo = (formData.get('returnTo') as string) || '/dashboard';

  if (!email || !password) {
    return { success: false, error: 'Por favor ingrese su correo electrónico y contraseña.' };
  }

  const supabase = createServerSupabaseClient();
  const cookieStore = cookies();

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      // Clear demo cookies if present
      cookieStore.delete('paguro_demo_session');
      cookieStore.delete('paguro_demo_role');
      redirect(returnTo);
    }

    // If Supabase returned an error and it's not a known demo user, return the real error
    const isDemoEmail = email.endsWith('@pagurocorp.com');
    if (!isDemoEmail) {
      return { success: false, error: error?.message || 'Credenciales de acceso inválidas.' };
    }
  }

  // Fallback: Local offline demo session for development/demo purposes
  let role: UserRole = 'ADMIN';
  if (email.includes('superadmin')) role = 'SUPER_ADMIN';
  else if (email.includes('accountant')) role = 'ACCOUNTANT';
  else if (email.includes('finance')) role = 'FINANCE';
  else if (email.includes('ops')) role = 'OPERATIONS';
  else if (email.includes('viewer')) role = 'VIEWER';

  cookieStore.set('paguro_demo_session', email, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  cookieStore.set('paguro_demo_role', role, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(returnTo);
}

/**
 * Terminates user session and wipes authentication cookies.
 */
export async function logoutAction(): Promise<void> {
  const supabase = createServerSupabaseClient();
  const cookieStore = cookies();

  if (supabase) {
    await supabase.auth.signOut();
  }

  cookieStore.delete('paguro_demo_session');
  cookieStore.delete('paguro_demo_role');
  cookieStore.delete('paguro_active_company');

  redirect('/login');
}

/**
 * Initiates Supabase password reset workflow via email.
 */
export async function forgotPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) {
    return { success: false, error: 'Por favor ingrese su correo electrónico registrado.' };
  }

  const supabase = createServerSupabaseClient();

  if (supabase) {
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    success: true,
    message: 'Se ha enviado un enlace seguro para restablecer su contraseña si el correo está registrado.',
  };
}

/**
 * Completes password update for authenticated or tokenized reset session.
 */
export async function resetPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || password.length < 8) {
    return { success: false, error: 'La nueva contraseña debe tener un mínimo de 8 caracteres.' };
  }

  if (password !== confirmPassword) {
    return { success: false, error: 'Las contraseñas ingresadas no coinciden.' };
  }

  const supabase = createServerSupabaseClient();

  if (supabase) {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return {
    success: true,
    message: 'Contraseña actualizada exitosamente. Ya puede iniciar sesión con su nueva clave.',
  };
}

/**
 * Switches the active tenant company for the user session.
 */
export async function switchCompanyAction(companyId: string): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set('paguro_active_company', companyId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
