import { NextRequest, NextResponse } from 'next/server';
import {
  type Factura, type Agente, type Embarque, type ReglaAlerta,
  calcularVencimiento, calcularDiasRestantes, clasificarEstadoPago,
  clasificarNotificacion, detectarError, debeProcesar,
  generarAvisoInterno, generarNotificacionPago, generarResumenHTML, REGLAS_ALERTA_DEFAULT,
} from '@/lib/agente-administracion/motor';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

// Destinatarios internos de Administración — TODOS los avisos de vencimiento
// van acá (Kadi es quien le debe al agente, no al revés). Distintos al
// equipo de Producción (Daniel/Paulet/Ruth) que usa el Agente de Tráfico.
const DESTINATARIOS_INTERNOS = [
  { nombre: 'Administración Kadi', email: 'adm.kadi@sicobenediciones.com' },
  { nombre: 'Stephannie Gallardo', email: 'soporte@sicobenediciones.com' },
];

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

// El cron de Vercel llega con CRON_SECRET; el botón "Ejecutar Ahora" del
// dashboard llega con la cookie de sesión normal de InfiniteX. Cualquier otra
// solicitud se rechaza — este endpoint queda públicamente alcanzable (el
// middleware lo exceptúa) para que el cron pueda llamarlo sin login.
function autorizado(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const cookie = req.cookies.get('ix-session')?.value;
  if (cookie === 'ix-connected-sicoben-2026') return true;
  return false;
}

// MODO_SIMULACION=true (o sin definir) por defecto — hasta que MailerSend
// quede resuelto, ningún correo real sale de aquí; todo queda registrado en
// notificaciones_facturas con estado_envio='simulado' para poder revisarlo.
function modoSimulacionActivo(): boolean {
  return process.env.MODO_SIMULACION !== 'false';
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
        // Mientras sicobenediciones.com no esté verificado en MailerSend, usa
        // el dominio de prueba (configurable por env var) — una vez
        // verificado el propio, basta con quitar MAILERSEND_FROM_EMAIL de
        // Vercel para volver al remitente definitivo.
        from: { email: process.env.MAILERSEND_FROM_EMAIL || 'noreply@sicobenediciones.com', name: 'InfiniteX · Sicoben Ediciones' },
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

async function yaNotificado(facturaId: string, tipo: string): Promise<boolean> {
  const res = await supabaseFetch(
    `notificaciones_facturas?factura_id=eq.${facturaId}&tipo_notificacion=eq.${tipo}&estado_envio=neq.error&select=id&limit=1`,
    { headers: { Prefer: 'return=representation' } }
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function registrarNotificacion(facturaId: string, tipo: string, destinatario: string, asunto: string, html: string, resultado: { ok: boolean; error?: string }, modoSimulacion: boolean) {
  await supabaseFetch('notificaciones_facturas', {
    method: 'POST',
    body: JSON.stringify({
      factura_id: facturaId,
      tipo_notificacion: tipo,
      destinatario,
      asunto,
      cuerpo_html: html,
      estado_envio: resultado.ok ? (modoSimulacion ? 'simulado' : 'enviado') : 'error',
      error_detalle: resultado.error || null,
    }),
  });
}

// Vercel Cron llama por GET; el botón "Ejecutar Ahora" del dashboard llama por
// POST — ambos ejecutan exactamente la misma lógica.
export async function GET(req: NextRequest) {
  return ejecutar(req);
}

export async function POST(req: NextRequest) {
  return ejecutar(req);
}

async function ejecutar(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const modoSimulacion = modoSimulacionActivo();
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);

  try {
    const [facturasRes, proveedoresRes, embarquesRes, reglasRes] = await Promise.all([
      supabaseFetch('facturas?select=*'),
      supabaseFetch('proveedores?select=*'),
      supabaseFetch('trafico_embarques?select=bl,llegada_real,descripcion,naviera'),
      supabaseFetch('reglas_alerta_facturas?select=*'),
    ]);
    const facturasRaw = await facturasRes.json();
    const proveedoresRaw = await proveedoresRes.json();
    const embarquesRaw = await embarquesRes.json();
    const reglasRaw = await reglasRes.json();
    if (!Array.isArray(facturasRaw)) {
      return NextResponse.json({ ok: false, error: 'Tabla "facturas" no disponible: ' + JSON.stringify(facturasRaw) }, { status: 500 });
    }
    const facturas: Factura[] = facturasRaw;
    const proveedores: Agente[] = Array.isArray(proveedoresRaw) ? proveedoresRaw : [];
    const embarques: Embarque[] = Array.isArray(embarquesRaw) ? embarquesRaw : [];
    const reglas: ReglaAlerta[] = Array.isArray(reglasRaw) && reglasRaw.length > 0 ? reglasRaw : REGLAS_ALERTA_DEFAULT;

    const proveedorPorId = new Map((proveedores || []).map((p: any) => [p.id, p]));
    const embarquePorBl = new Map((embarques || []).map((e: any) => [e.bl, e]));

    const resumen = {
      pendientes: 0, vencen15d: 0, vencen7d: 0, vencen3d: 0, vencenManana: 0, vencenHoy: 0,
      vencidas: 0, pagadasRecientes: 0, sinLlegada: 0, sinCredito: 0, conErrores: 0,
    };
    const detalleErrores: { factura: string; motivo: string }[] = [];
    const notificacionesEnviadas: { factura: string; tipo: string; destinatario: string }[] = [];

    // Notificación de pago al agente — la ÚNICA que sale hacia afuera, y solo
    // una vez, cuando la factura ya está Pagada. Todo lo demás es interno.
    async function intentarNotificarPago(factura: Factura) {
      if (!factura.agente_id) return;
      const agente = proveedorPorId.get(factura.agente_id) as Agente | undefined;
      if (!agente?.email) return;
      if (await yaNotificado(factura.id, 'pago_confirmado')) return;
      const { asunto, html } = generarNotificacionPago(factura, agente);
      const resultado = await enviarCorreo(agente.email, asunto, html);
      await registrarNotificacion(factura.id, 'pago_confirmado', agente.email, asunto, html, resultado, modoSimulacion);
      notificacionesEnviadas.push({ factura: factura.numero_factura || factura.id, tipo: 'pago_confirmado', destinatario: agente.email });
    }

    // Aviso interno cuando la carga llega al puerto — arranca el crédito.
    // Independiente de si la factura tiene otros datos incompletos: es sobre
    // el embarque, no sobre la factura en sí.
    async function intentarNotificarLlegada(factura: Factura, agente: Agente | null, embarque: Embarque | null) {
      if (!embarque?.llegada_real || agente?.dias_credito == null) return;
      if (await yaNotificado(factura.id, 'llegada_carga')) return;
      const vencimiento = calcularVencimiento(embarque.llegada_real, agente.dias_credito)!;
      const diasRestantes = calcularDiasRestantes(hoyISO, vencimiento)!;
      const { asunto, html } = generarAvisoInterno('llegada_carga', { factura, agente, embarque, vencimiento, diasRestantes });
      for (const dest of DESTINATARIOS_INTERNOS) {
        const resultado = await enviarCorreo(dest.email, asunto, html);
        await registrarNotificacion(factura.id, 'llegada_carga', dest.email, asunto, html, resultado, modoSimulacion);
      }
      notificacionesEnviadas.push({ factura: factura.numero_factura || factura.id, tipo: 'llegada_carga', destinatario: 'Administración' });
    }

    for (const factura of facturas || []) {
      if (!debeProcesar(factura)) {
        if (factura.estado_pago === 'Pagada') {
          resumen.pagadasRecientes++;
          await intentarNotificarPago(factura);
        }
        continue;
      }

      const agente = factura.agente_id ? (proveedorPorId.get(factura.agente_id) as Agente | undefined) || null : null;
      const embarque = factura.embarque_bl ? (embarquePorBl.get(factura.embarque_bl) as Embarque | undefined) || null : null;

      await intentarNotificarLlegada(factura, agente, embarque);

      const motivo = detectarError(factura, agente, embarque);
      if (motivo) {
        resumen.conErrores++;
        if (motivo.includes('llegada al puerto')) resumen.sinLlegada++;
        if (motivo.includes('condición de crédito')) resumen.sinCredito++;
        detalleErrores.push({ factura: factura.numero_factura || factura.id, motivo });
        await supabaseFetch(`facturas?id=eq.${factura.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ motivo_error: motivo, updated_at: new Date().toISOString() }),
        });
        continue;
      }

      const vencimiento = calcularVencimiento(embarque!.llegada_real, agente!.dias_credito)!;
      const diasRestantes = calcularDiasRestantes(hoyISO, vencimiento)!;
      const nuevoEstado = clasificarEstadoPago(diasRestantes);
      const tipoNotif = clasificarNotificacion(diasRestantes, reglas);

      resumen.pendientes++;
      if (diasRestantes === 15) resumen.vencen15d++;
      if (diasRestantes === 7) resumen.vencen7d++;
      if (diasRestantes === 3) resumen.vencen3d++;
      if (diasRestantes === 1) resumen.vencenManana++;
      if (diasRestantes === 0) resumen.vencenHoy++;
      if (diasRestantes < 0) resumen.vencidas++;

      await supabaseFetch(`facturas?id=eq.${factura.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado_pago: nuevoEstado, motivo_error: null, updated_at: new Date().toISOString() }),
      });

      if (!tipoNotif) continue;
      if (await yaNotificado(factura.id, tipoNotif)) continue;

      const { asunto, html } = generarAvisoInterno(tipoNotif, {
        factura, agente: agente!, embarque: embarque!, vencimiento, diasRestantes,
      });
      for (const dest of DESTINATARIOS_INTERNOS) {
        const resultado = await enviarCorreo(dest.email, asunto, html);
        await registrarNotificacion(factura.id, tipoNotif, dest.email, asunto, html, resultado, modoSimulacion);
      }
      notificacionesEnviadas.push({ factura: factura.numero_factura || factura.id, tipo: tipoNotif, destinatario: 'Administración' });
    }

    const fechaHoy = `${hoy.getUTCDate()} de ${
      ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][hoy.getUTCMonth()]
    } de ${hoy.getUTCFullYear()}`;
    const asuntoResumen = `[InfiniteX] Reporte diario de Administración — ${fechaHoy}`;
    const htmlResumen = generarResumenHTML(fechaHoy, resumen, detalleErrores);
    for (const dest of DESTINATARIOS_INTERNOS) {
      await enviarCorreo(dest.email, asuntoResumen, htmlResumen);
    }

    return NextResponse.json({ ok: true, modoSimulacion, fecha: hoyISO, resumen, notificacionesEnviadas, detalleErrores });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
