import { NextResponse } from 'next/server';

const USUARIO = process.env.IX_USER ?? 'logistica@sicobenediciones.com';
const CLAVE    = process.env.IX_PASS ?? 'Y18442474t.';
const SESSION  = 'ix-connected-sicoben-2026';

export async function POST(req: Request) {
  const { usuario, clave } = await req.json();

  if (usuario?.toLowerCase() === USUARIO.toLowerCase() && clave === CLAVE) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('ix-session', SESSION, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: 'Credenciales incorrectas' }, { status: 401 });
}
