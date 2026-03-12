import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Create client - will work at runtime when env vars are set
// During build, uses placeholders which is fine for static analysis
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

/** Server-only client using service role key. Bypasses RLS - use for API routes that need guaranteed access. */
function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return createClient(supabaseUrl, supabaseAnonKey)
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export const supabaseAdmin = createServerClient()

