import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL or Anon Key is missing in environment variables.')
}

console.log(`[Supabase] Initializing client in ${import.meta.env.MODE} mode`)
console.log(`[Supabase] Connected to: ${supabaseUrl}`)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
