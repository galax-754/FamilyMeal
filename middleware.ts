import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON } from './config'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas completamente públicas — NO redirigir nunca
  const publicPaths = [
    '/login',
    '/registro',
    '/registrar',
    '/unirse',      // página de invitación: debe ser accesible sin auth
    '/onboarding',
    '/api/',
    '/_next/',
    '/favicon',
    '/fonts/',
    '/images/',
  ]

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path))

  if (isPublicPath) {
    return NextResponse.next()
  }

  // Para rutas protegidas verificar sesión
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        response = NextResponse.next({
          request: { headers: request.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión en ruta protegida → login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Con sesión pero sin familia → onboarding (excepto si ya está ahí)
  if (pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (!profile?.family_id) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
