import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  const publicPaths = ['/login', '/register', '/api/auth/login', '/api/auth/register']
  const isPublicPath = publicPaths.some(p => path === p || path.startsWith('/api/auth/'))

  const isApiRoute = path.startsWith('/api/')
  const isAuthApiRoute = path.startsWith('/api/auth/')

  const user = await getSession()

  if (!user && !isPublicPath) {
    if (isApiRoute && !isAuthApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp)$).*)',
  ],
}
