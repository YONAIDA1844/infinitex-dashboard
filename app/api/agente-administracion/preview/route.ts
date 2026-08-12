import { NextRequest, NextResponse } from 'next/server';
import {
  type Factura, type Agente, type Embarque, type ReglaAlerta,
  calcularVencimiento, calcularDiasRestantes, clasificarNotificacion,
  generarAvisoInterno, generarNotificacionPago, REGLAS_ALERTA_DEFAULT,
} from '@/lib/agente-administracion/motor';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

function autorizado(req: NextRequest): boolean {
  const cookie = req.cookies.get('ix-session')?.value;
  return cookie === 'ix-connected-sicoben-2026';
}

async function supabaseFetch(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
}

// Solo lectura — genera el mismo contenido que enviaría/registraría run/route.ts,
// pero sin tocar la base de datos ni intentar enviar nada. Para que Administración
// pueda ver "cómo le llega el mensaje" antes de que salga de verdad.
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  try {
    const { facturaId } = await req.json();
    if (!facturaId) return NextResponse.json({ ok: false, error: 'Falta facturaId' }, { status: 400 });

    const [facturaRes, proveedoresRes, embarquesRes, reglasRes] = await Promise.all([
      supabaseFetch(`facturas?id=eq.${facturaId}&select=*`),
      supabaseFetch('proveedores?select=*'),
      supabaseFetch('trafico_embarques?select=bl,llegada_real,descripcion,naviera'),
      supabaseFetch('reglas_alerta_facturas?select=*'),
    ]);
    const facturaData = await facturaRes.json();
    const factura: Factura | null = Array.isArray(facturaData) && facturaData[0] ? facturaData[0] : null;
    if (!factura) return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 });

    const proveedores: Agente[] = await proveedoresRes.json().catch(() => []);
    const embarques: Embarque[] = await embarquesRes.json().catch(() => []);
    const reglasRaw = await reglasRes.json().catch(() => []);
    const reglas: ReglaAlerta[] = Array.isArray(reglasRaw) && reglasRaw.length > 0 ? reglasRaw : REGLAS_ALERTA_DEFAULT;

    const agente = factura.agente_id ? (Array.isArray(proveedores) ? proveedores.find((p: any) => p.id === factura.agente_id) : null) : null;
    const embarque = factura.embarque_bl ? (Array.isArray(embarques) ? embarques.find((e: any) => e.bl === factura.embarque_bl) : null) : null;

    const resultado: any = { ok: true, factura, agente, embarque };

    if (factura.estado_pago === 'Pagada' && agente?.email) {
      resultado.pago = generarNotificacionPago(factura, agente);
    }

    if (agente && embarque?.llegada_real && agente.dias_credito != null) {
      const vencimiento = calcularVencimiento(embarque.llegada_real, agente.dias_credito)!;
      const hoyISO = new Date().toISOString().slice(0, 10);
      const diasRestantes = calcularDiasRestantes(hoyISO, vencimiento)!;
      const tipo = clasificarNotificacion(diasRestantes, reglas) || 'manual';
      resultado.interno = { ...generarAvisoInterno(tipo, { factura, agente, embarque, vencimiento, diasRestantes }), tipo, vencimiento, diasRestantes };
    }

    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
