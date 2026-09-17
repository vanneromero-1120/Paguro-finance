// ============================================================================
// Paguro Finance - Supabase Client Factory (Browser)
// ============================================================================

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return dummy client if env vars are not set yet during development
    return null;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
