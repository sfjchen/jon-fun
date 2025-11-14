import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Create client - will work at runtime when env vars are set
// During build, uses placeholders which is fine for static analysis
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

