// Motor de cálculo del Agente de Administración — funciones puras, sin llamadas a
// red ni a base de datos, para poder testearlas con casos simulados antes de
// tocar datos reales (ver sección 20 del requerimiento: "no un prototipo
// superficial").
//
// Regla de negocio central: el crédito NO se cuenta desde la fecha de la
// factura, sino desde la fecha real de llegada de la mercancía al puerto
// (trafico_embarques.llegada_real). Ver README del Agente de Administración.

export type EstadoPago =
  | 'Pendiente'
  | 'Próxima a vencer'
  | 'Vencimiento inminente'
  | 'Vencida'
  | 'En proceso de pago'
  | 'Pagada';

// Estados que el motor puede asignar automáticamente. "En proceso de pago" y
// "Pagada" son decisiones humanas — el motor nunca las asigna, y si una factura
// ya está en uno de esos dos estados, el motor la salta por completo (sección 11).
const ESTADOS_AUTOMATICOS: EstadoPago[] = ['Pendiente', 'Próxima a vencer', 'Vencimiento inminente', 'Vencida'];

export interface ReglaAlerta {
  dias_offset: number;
  tipo_notificacion: string;
  activo: boolean;
}

// Set de reglas por defecto (sección 7) — usadas si la tabla reglas_alerta_facturas
// está vacía o no se pudo leer, para que el motor nunca se quede sin clasificar.
export const REGLAS_ALERTA_DEFAULT: ReglaAlerta[] = [
  { dias_offset: 7, tipo_notificacion: 'preventivo_7d', activo: true },
  { dias_offset: 3, tipo_notificacion: 'seguimiento_3d', activo: true },
  { dias_offset: 1, tipo_notificacion: 'alerta_1d', activo: true },
  { dias_offset: 0, tipo_notificacion: 'vencimiento_hoy', activo: true },
  { dias_offset: -1, tipo_notificacion: 'vencida', activo: true },
];

export interface Factura {
  id: string;
  numero_factura: string | null;
  embarque_bl: string | null;
  agente_id: string | null;
  monto: number | null;
  moneda: string | null;
  fecha_factura: string | null;
  fecha_pago: string | null;
  estado_pago: string;
  observaciones?: string | null;
}

export interface Agente {
  id: string;
  nombre: string;
  email: string | null;
  dias_credito: number | null;
}

export interface Embarque {
  bl: string;
  llegada_real: string | null;
  descripcion?: string | null;
  naviera?: string | null;
}

function parseISO(d: string): Date {
  return new Date(d.includes('T') ? d : d + 'T12:00:00Z');
}

/**
 * Vencimiento = fecha real de llegada al puerto + días de crédito del agente.
 * null si falta cualquiera de los dos insumos (la factura queda "sin fecha").
 */
export function calcularVencimiento(llegadaReal: string | null, diasCredito: number | null): string | null {
  if (!llegadaReal || diasCredito == null) return null;
  const dt = parseISO(llegadaReal);
  if (isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + diasCredito);
  return dt.toISOString().slice(0, 10);
}

/** Días restantes hasta el vencimiento (negativo = ya venció). */
export function calcularDiasRestantes(hoyISO: string, vencimiento: string | null): number | null {
  if (!vencimiento) return null;
  const hoy = parseISO(hoyISO);
  const venc = parseISO(vencimiento);
  if (isNaN(hoy.getTime()) || isNaN(venc.getTime())) return null;
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
}

/**
 * Mapea días restantes al estado visible en el dashboard. Las franjas siguen
 * las mismas reglas de alerta (7/3/1/0 días) para que estado y notificación
 * cuenten la misma historia.
 */
export function clasificarEstadoPago(diasRestantes: number | null): EstadoPago {
  if (diasRestantes == null) return 'Pendiente';
  if (diasRestantes < 0) return 'Vencida';
  if (diasRestantes <= 3) return 'Vencimiento inminente';
  if (diasRestantes <= 7) return 'Próxima a vencer';
  return 'Pendiente';
}

/**
 * Determina qué tipo de recordatorio corresponde HOY según días restantes.
 * Devuelve null si ningún umbral configurado aplica hoy (ej. faltan 5 días y
 * las reglas son 7/3/1/0). Cualquier offset negativo se trata como "vencida"
 * — no hace falta una regla por cada día vencido.
 */
export function clasificarNotificacion(diasRestantes: number | null, reglas: ReglaAlerta[] = REGLAS_ALERTA_DEFAULT): string | null {
  if (diasRestantes == null) return null;
  const activas = reglas.filter(r => r.activo);
  for (const r of activas) {
    if (r.dias_offset < 0 && diasRestantes < 0) return r.tipo_notificacion;
    if (r.dias_offset >= 0 && diasRestantes === r.dias_offset) return r.tipo_notificacion;
  }
  return null;
}

/**
 * Valida los casos de la sección 10 antes de procesar una factura. Devuelve el
 * motivo exacto a registrar, o null si todo está en orden. El orden de los
 * checks importa: se reporta el primer problema encontrado, no todos a la vez.
 */
export function detectarError(factura: Factura, agente: Agente | null, embarque: Embarque | null): string | null {
  if (!factura.numero_factura) return 'Falta número de factura';
  if (factura.monto == null) return 'Factura sin monto';
  if (factura.fecha_pago && factura.estado_pago !== 'Pagada') {
    return 'Información contradictoria: tiene fecha de pago pero no está marcada como Pagada';
  }
  if (!factura.embarque_bl) return 'Falta embarque/BL asociado';
  if (!embarque) return `Embarque "${factura.embarque_bl}" no encontrado en Tráfico`;
  if (!embarque.llegada_real) return 'Falta fecha de llegada al puerto';
  if (!factura.agente_id) return 'Falta agente logístico asociado';
  if (!agente) return 'Agente logístico no encontrado';
  if (agente.dias_credito == null) return `Agente "${agente.nombre}" sin condición de crédito configurada`;
  if (!agente.email) return `Agente "${agente.nombre}" sin email de contacto`;
  return null;
}

/** ¿El motor debe procesar esta factura, o ya está en un estado manual/terminal? */
export function debeProcesar(factura: Factura): boolean {
  return ESTADOS_AUTOMATICOS.includes(factura.estado_pago as EstadoPago);
}

// ---------------------------------------------------------------------------
// Plantillas de correo (sección 9) — tono profesional, sin lenguaje agresivo,
// apropiado para agentes logísticos internacionales. Mismo estilo visual que
// el Reporte Diario existente (InfiniteX / Sicoben Ediciones).
// ---------------------------------------------------------------------------

const MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function fmtLarga(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} de ${MESES_L[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function fmtMonto(monto: number, moneda: string): string {
  return `${moneda} ${monto.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DatosCorreo {
  factura: Factura;
  agente: Agente;
  embarque: Embarque;
  vencimiento: string;
  diasRestantes: number;
}

const PLANTILLA_COPY: Record<string, { titulo: string; color: string; cuerpo: (d: DatosCorreo) => string }> = {
  preventivo_7d: {
    titulo: 'Recordatorio de pago próximo',
    color: '#1f6feb',
    cuerpo: d => `Le escribimos para anticiparle que la factura <strong>${d.factura.numero_factura}</strong> vence en <strong>7 días</strong>, el ${fmtLarga(d.vencimiento)}. No se requiere ninguna acción inmediata — este es solo un aviso preventivo para su planificación.`,
  },
  seguimiento_3d: {
    titulo: 'Seguimiento de pago',
    color: '#d29922',
    cuerpo: d => `Le recordamos que la factura <strong>${d.factura.numero_factura}</strong> vence en <strong>3 días</strong>, el ${fmtLarga(d.vencimiento)}. Agradecemos coordinar el pago dentro del plazo acordado.`,
  },
  alerta_1d: {
    titulo: 'Factura vence mañana',
    color: '#d9730d',
    cuerpo: d => `La factura <strong>${d.factura.numero_factura}</strong> vence <strong>mañana</strong>, ${fmtLarga(d.vencimiento)}. Le pedimos amablemente confirmar el estado del pago.`,
  },
  vencimiento_hoy: {
    titulo: 'Factura vence hoy',
    color: '#c0261f',
    cuerpo: d => `La factura <strong>${d.factura.numero_factura}</strong> vence <strong>hoy</strong>, ${fmtLarga(d.vencimiento)}. Quedamos atentos a la confirmación del pago.`,
  },
  vencida: {
    titulo: 'Factura vencida — seguimiento',
    color: '#8b0000',
    cuerpo: d => `La factura <strong>${d.factura.numero_factura}</strong> venció el ${fmtLarga(d.vencimiento)} (hace ${Math.abs(d.diasRestantes)} día${Math.abs(d.diasRestantes) === 1 ? '' : 's'}). Le solicitamos amablemente coordinar el pago a la brevedad, o informarnos si ya fue procesado para actualizar nuestros registros.`,
  },
};

export interface ResumenDiario {
  pendientes: number;
  vencen7d: number;
  vencen3d: number;
  vencenManana: number;
  vencenHoy: number;
  vencidas: number;
  pagadasRecientes: number;
  sinLlegada: number;
  sinCredito: number;
  conErrores: number;
}

/** Reporte diario interno (sección 14) — mismo estilo visual que las plantillas de arriba. */
export function generarResumenHTML(fecha: string, resumen: ResumenDiario, errores: { factura: string; motivo: string }[]): string {
  const tile = (label: string, valor: number, color: string) =>
    `<td style="width:20%;text-align:center;padding:0 5px 10px;"><div style="background:${color}18;border-radius:8px;padding:10px 4px;"><div style="font-size:22px;font-weight:800;color:${color};">${valor}</div><div style="font-size:8px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">${label}</div></div></td>`;
  const filasErrores = errores.length
    ? errores.map(e => `<tr><td style="padding:6px 10px;font-size:12px;color:#1a2332;border-bottom:1px solid #e8edf2;">${e.factura}</td><td style="padding:6px 10px;font-size:12px;color:#c0261f;border-bottom:1px solid #e8edf2;">${e.motivo}</td></tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px;font-size:12px;color:#4a5568;">Sin errores hoy.</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:20px 10px;"><tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1a2332;padding:20px 28px;">
  <div style="font-size:20px;font-weight:800;color:#fff;">REPORTE DIARIO DE ADMINISTRACIÓN</div>
  <div style="font-size:12px;color:#8b949e;margin-top:2px;">${fecha} — Facturas de agentes logísticos</div>
</td></tr>
<tr><td style="padding:20px 24px 6px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${tile('Pendientes', resumen.pendientes, '#1f6feb')}
    ${tile('Vencen 7d', resumen.vencen7d, '#1f6feb')}
    ${tile('Vencen 3d', resumen.vencen3d, '#d29922')}
    ${tile('Vencen mañana', resumen.vencenManana, '#d9730d')}
    ${tile('Vencen hoy', resumen.vencenHoy, '#c0261f')}
  </tr><tr>
    ${tile('Vencidas', resumen.vencidas, '#8b0000')}
    ${tile('Pagadas recientes', resumen.pagadasRecientes, '#1a9e5c')}
    ${tile('Sin fecha llegada', resumen.sinLlegada, '#718096')}
    ${tile('Sin crédito', resumen.sinCredito, '#718096')}
    ${tile('Con errores', resumen.conErrores, '#c0261f')}
  </tr></table>
</td></tr>
<tr><td style="padding:6px 24px 20px;">
  <div style="font-size:11px;font-weight:700;color:#3498db;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">FACTURAS CON ERRORES</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:8px;overflow:hidden;">${filasErrores}</table>
</td></tr>
<tr><td style="background:#f0f4f8;padding:14px 28px;font-size:11px;color:#8b949e;">InfiniteX · Sicoben Ediciones Panamá — generado automáticamente por el Agente de Administración.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function generarEmailFactura(tipo: string, datos: DatosCorreo): { asunto: string; html: string } {
  const p = PLANTILLA_COPY[tipo] || PLANTILLA_COPY.seguimiento_3d;
  const { factura, agente, embarque } = datos;
  const asunto = `[Sicoben Ediciones] ${p.titulo} — Factura ${factura.numero_factura}`;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:20px 10px;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1a2332;padding:20px 28px;border-bottom:3px solid ${p.color};">
  <div style="font-size:20px;font-weight:800;color:#fff;">InfiniteX <span style="color:#5ba3e0;">·</span> Sicoben Ediciones</div>
  <div style="font-size:12px;color:#8b949e;margin-top:2px;">Kadi Internacional S.A.</div>
</td></tr>
<tr><td style="padding:24px 28px;">
  <div style="display:inline-block;background:${p.color}18;color:${p.color};font-weight:700;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:20px;margin-bottom:14px;">${p.titulo}</div>
  <p style="font-size:14px;color:#1a2332;line-height:1.6;">Estimado equipo de <strong>${agente.nombre}</strong>,</p>
  <p style="font-size:14px;color:#1a2332;line-height:1.6;">${p.cuerpo(datos)}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:8px;margin:18px 0;">
    <tr><td style="padding:14px 18px;font-size:13px;color:#4a5568;">
      <div style="margin-bottom:6px;"><strong>Factura:</strong> ${factura.numero_factura}</div>
      <div style="margin-bottom:6px;"><strong>Embarque:</strong> ${embarque.descripcion || embarque.bl}</div>
      <div style="margin-bottom:6px;"><strong>Monto:</strong> ${factura.monto != null ? fmtMonto(factura.monto, factura.moneda || 'USD') : '-'}</div>
      <div style="margin-bottom:6px;"><strong>Llegada al puerto:</strong> ${fmtLarga(embarque.llegada_real!)}</div>
      <div><strong>Fecha de vencimiento:</strong> ${fmtLarga(datos.vencimiento)}</div>
    </td></tr>
  </table>
  <p style="font-size:13px;color:#718096;line-height:1.6;">Quedamos atentos a cualquier consulta. Gracias por su colaboración.</p>
</td></tr>
<tr><td style="background:#f0f4f8;padding:14px 28px;font-size:11px;color:#8b949e;">InfiniteX · Sicoben Ediciones Panamá — correo generado automáticamente por el Agente de Administración.</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { asunto, html };
}
