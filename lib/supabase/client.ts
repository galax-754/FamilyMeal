'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON } from '@/config'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON)
}
