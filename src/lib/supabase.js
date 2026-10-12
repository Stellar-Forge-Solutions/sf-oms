import { createClient } from '@supabase/supabase-js'

// Same Supabase project as sf-billing. Put these in .env (see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
// Database tables: see supabase/orders_schema.sql
