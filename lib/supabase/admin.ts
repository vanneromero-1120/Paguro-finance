// ============================================================================
// Paguro Finance - Supabase Service Role Admin Client
// ============================================================================
// SECURITY NOTICE:
// This client initializes with the SUPABASE_SERVICE_ROLE_KEY, which completely
// bypasses Row Level Security (RLS).
//
// STRICT CONSTRAINTS:
// 1. MUST NEVER be imported, bundled, or invoked in client-side code or browser components.
// 2. MUST ONLY be utilized in trusted server-side jobs (migrations, administrative seeders,
//    audit logging workers, or system maintenance tasks).
// 3. Always prefer createServerSupabaseClient() with user session cookies for standard
//    business operations so that PostgreSQL RLS policies are strictly enforced.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('FATAL SECURITY VIOLATION: createAdminClient cannot be called from browser/client context.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
