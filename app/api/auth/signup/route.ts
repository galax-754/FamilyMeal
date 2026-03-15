export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON } from '@/config'

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json()

  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name: cookieName, value, options }) => {
          response.cookies.set(cookieName, value, options)
        })
      },
    },
  })

  const origin = request.nextUrl.origin
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return response
}
