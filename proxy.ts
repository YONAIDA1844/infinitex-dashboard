import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_VALUE = 'ix-connected-sicoben-2026';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('ix-session')?.value;
  const autenticado = session === SESSION_VALUE;

  // Rutas públicas
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    if (autenticado) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // Rutas protegidas
  if (!autenticado) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
