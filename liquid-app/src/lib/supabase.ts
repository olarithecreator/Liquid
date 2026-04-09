import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// In dev, env values should exist. We throw so failures are immediate and obvious.
if (!url) throw new Error('Missing VITE_SUPABASE_URL in environment')
if (!key) throw new Error('Missing VITE_SUPABASE_ANON_KEY in environment')

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    storageKey: 'liquid-user-auth',
  },
})

// Keep admin auth isolated so admin and user can stay signed-in independently
// on the same browser/device without overriding each other's session.
export const adminSupabase: SupabaseClient = createClient(url, key, {
  auth: {
    storageKey: 'liquid-admin-auth',
  },
})
