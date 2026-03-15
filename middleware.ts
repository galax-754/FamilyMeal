import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON } from './config'

const APP_ROUTES        = ['/inicio', '/comidas', '/menu', '/tareas', '/familia', '/preferencias']
const AUTH_ROUTES       = ['/login', '/registrar']
const ONBOARDING_EXEMPT = ['/onboarding', '/unirse', '/api']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAppRoute  = APP_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  const isExempt    = ONBOARDING_EXEMPT.some((p) => pathname.startsWith(p))

  const isOnboardingPath = pathname.startsWith('/onboarding')

  // Redirigir a login si no autenticado en ruta protegida o en onboarding
  if (!user && (isAppRoute || isOnboardingPath)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirigir a inicio si ya autenticado en rutas de auth
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/inicio', request.url))
  }

  // Verificar familia para rutas protegidas y onboarding
  if (user && (isAppRoute || isOnboardingPath) && !isExempt) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    // Sin familia: redirigir a onboarding (excepto si ya está ahí)
    if (!profile?.family_id && !isOnboardingPath) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // Con familia: si está en onboarding, redirigir a inicio
    if (profile?.family_id && isOnboardingPath) {
      return NextResponse.redirect(new URL('/inicio', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|api/).*)'],
}
