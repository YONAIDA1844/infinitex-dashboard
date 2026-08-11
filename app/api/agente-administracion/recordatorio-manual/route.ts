import { NextRequest, NextResponse } from 'next/server';
import {
  type Factura, type Agente, type Embarque,
  calcularVencimiento, calcularDiasRestantes, generarAvisoInterno,
} from '@/lib/agente-administracion/motor';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

const DESTINATARIOS_INTERNOS = [
  { nombre: 'Administración Kadi', email: 'adm.kadi@sicobenediciones.com' },
  { nombre: 'Stephannie Gallardo', email: 'soporte@sicobenediciones.com' },
];

function autorizado(req: NextRequest): boolean {
  const cookie = req.cookies.get('ix-session')?.value;
  return cookie === 'ix-connected-sicoben-2026';
}

function modoSimulacionActivo(): boolean {
  return process.env.MODO_SIMULACION !== 'false';
}

async function supabaseFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal',
      ...(init?.headers || {}),
    },
  });
}

async function enviarCorreo(destinatario: string, asunto: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (modoSimulacionActivo()) return { ok: true };
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'MAILERSEND_API_KEY no configurada' };
  try {
    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: 'noreply@sicobenediciones.com', name: 'InfiniteX · Sicoben Ediciones' },
        to: [{ email: destinatario }],
        subject: asunto,
        html,
      }),
    });
    if (!res.ok) return { ok: false, error: `MailerSend ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Recordatorio interno inmediato para UNA factura, sin esperar al umbral de
// días exacto ni al cron diario — "quiero mandarlo hoy" (pedido explícito del
// usuario). Se registra con tipo 'manual' y NO respeta la regla anti-spam de
// los otros tipos (es una acción explícita), pero sigue yendo solo a
// Administración, nunca al agente — misma regla de dirección que run/route.ts.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  try {
    const { facturaId } = await req.json();
    if (!facturaId) return NextResponse.json({ ok: false, error: 'Falta facturaId' }, { status: 400 });

    const [facturaRes, proveedoresRes, embarquesRes] = await Promise.all([
      supabaseFetch(`facturas?id=eq.${facturaId}&select=*`),
      supabaseFetch('proveedores?select=*'),
      supabaseFetch('trafico_embarques?select=bl,llegada_real,descripcion,naviera'),
    ]);
    const facturaData = await facturaRes.json();
    const factura: Factura | null = Array.isArray(facturaData) && facturaData[0] ? facturaData[0] : null;
    if (!factura) return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 });

    const proveedores: Agente[] = await proveedoresRes.json().catch(() => []);
    const embarques: Embarque[] = await embarquesRes.json().catch(() => []);
    const agente = factura.agente_id ? (Array.isArray(proveedores) ? proveedores.find((p: any) => p.id === factura.agente_id) : null) : null;
    const embarque = factura.embarque_bl ? (Array.isArray(embarques) ? embarques.find((e: any) => e.bl === factura.embarque_bl) : null) : null;

    if (!agente || !embarque?.llegada_real || agente.dias_credito == null) {
      return NextResponse.json({ ok: false, error: 'Faltan datos (agente, llegada al puerto o crédito) para generar el recordatorio.' }, { status: 400 });
    }

    const modoSimulacion = modoSimulacionActivo();
    const vencimiento = calcularVencimiento(embarque.llegada_real, agente.dias_credito)!;
    const hoyISO = new Date().toISOString().slice(0, 10);
    const diasRestantes = calcularDiasRestantes(hoyISO, vencimiento)!;
    const { asunto, html } = generarAvisoInterno('manual', { factura, agente, embarque, vencimiento, diasRestantes });

    for (const dest of DESTINATARIOS_INTERNOS) {
      const resultado = await enviarCorreo(dest.email, asunto, html);
      await supabaseFetch('notificaciones_facturas', {
        method: 'POST',
        body: JSON.stringify({
          factura_id: factura.id,
          tipo_notificacion: 'manual',
          destinatario: dest.email,
          asunto,
          cuerpo_html: html,
          estado_envio: resultado.ok ? (modoSimulacion ? 'simulado' : 'enviado') : 'error',
          error_detalle: resultado.error || null,
        }),
      });
    }

    return NextResponse.json({ ok: true, modoSimulacion, asunto, html, destinatarios: DESTINATARIOS_INTERNOS.map(d => d.email) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
