import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CAMPOS = [
  'agente_operador', 'naviera', 'tipo_contenedor', 'incoterm',
  'puerto_origen', 'puerto_destino', 'etd', 'tiempo_transito', 'eta',
  'dias_libres', 'flete_maritimo', 'seguro', 'gastos_origen',
  'gastos_destino', 'costo_total', 'validez', 'observaciones',
];

const PROMPT = `Eres un experto en logística internacional. Se te proporcionará una cotización de flete en PDF.
Extrae exactamente los siguientes campos. Si un campo no está en el documento, coloca null.

REGLA IMPORTANTE: Si tienes ETD (fecha de salida) y días de tránsito, pero NO hay fecha ETA, CALCÚLALA sumando los días a la fecha ETD y colócala en formato dd/mm/yyyy.

Devuelve SOLO un JSON válido, sin texto adicional:

{
  "agente_operador": "nombre del agente de carga u operador logístico",
  "naviera": "naviera propuesta (Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, COSCO, etc.)",
  "tipo_contenedor": "tipo de contenedor (40HC, 40', 20', 45HC, LCL, etc.)",
  "incoterm": "condición de venta (FOB, CIF, EXW, CFR, DDP, etc.)",
  "puerto_origen": "puerto de origen",
  "puerto_destino": "puerto de destino",
  "etd": "fecha estimada de salida en formato dd/mm/yyyy",
  "tiempo_transito": "número de días de tránsito (ej: 30 días)",
  "eta": "fecha estimada de llegada en formato dd/mm/yyyy. Si no está, CALCÚLALA con ETD + días de tránsito.",
  "dias_libres": "días libres en destino para retiro del contenedor (ej: 14 días libres, 21 días libres)",
  "flete_maritimo": "costo flete marítimo con moneda (ej: USD 2,500)",
  "seguro": "costo seguro si aplica, o null",
  "gastos_origen": "cargos en origen con moneda",
  "gastos_destino": "cargos en destino con moneda",
  "costo_total": "costo total estimado con moneda",
  "validez": "período o fecha de validez",
  "observaciones": "condiciones importantes, notas relevantes"
}`;

function calcularETA(etd: string | null, transitoDias: string | null): string | null {
  if (!etd || !transitoDias) return null;
  const dias = parseInt(transitoDias.replace(/[^0-9]/g, ''));
  if (!dias) return null;
  const parts = etd.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!parts) return null;
  const [, d, m, y] = parts;
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
  const fecha = new Date(year, parseInt(m) - 1, parseInt(d));
  fecha.setDate(fecha.getDate() + dias);
  return `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}/${fecha.getFullYear()}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { archivos } = body as { archivos: { nombre: string; base64: string }[] };
    if (!archivos || archivos.length < 1) return NextResponse.json({ ok: false, error: 'Se requiere al menos 1 cotización' }, { status: 400 });
    if (archivos.length > 4) return NextResponse.json({ ok: false, error: 'Máximo 4 cotizaciones' }, { status: 400 });

    const resultados = await Promise.all(archivos.map(async (archivo) => {
      try {
        const msg = await client.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 1024,
          messages: [{ role: 'user', content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: archivo.base64 } },
            { type: 'text', text: PROMPT },
          ]}],
        });
        const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        const datos = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        if (!datos.eta && datos.etd && datos.tiempo_transito) {
          const calc = calcularETA(datos.etd, datos.tiempo_transito);
          if (calc) datos.eta = calc + ' *';
        }
        return { nombre: archivo.nombre, ok: true, datos };
      } catch (e) {
        return { nombre: archivo.nombre, ok: false, datos: null, error: String(e) };
      }
    }));

    const exitosas = resultados.filter(r => r.ok && r.datos);
    let recomendacion = null;
    let recomendadoIndex = -1;

    if (exitosas.length >= 2) {
      const resumen = exitosas.map((r, i) =>
        `Opción ${i+1} — ${r.datos.agente_operador || r.nombre}:
  Naviera: ${r.datos.naviera} | Contenedor: ${r.datos.tipo_contenedor} | Incoterm: ${r.datos.incoterm}
  ETD: ${r.datos.etd} | ETA: ${r.datos.eta} | Tránsito: ${r.datos.tiempo_transito} | Días libres: ${r.datos.dias_libres}
  Costo total: ${r.datos.costo_total} | Flete: ${r.datos.flete_maritimo}`
      ).join('\n\n');

      const recMsg = await client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 700,
        messages: [{ role: 'user', content: `Analiza estas cotizaciones de flete y responde en JSON con este formato exacto, sin texto adicional:
{"indice": <número de la mejor opción, empezando en 0>, "razon": "<explicación de 3-4 oraciones en español indicando cuál es mejor y por qué, comparando costo, tiempo de tránsito, días libres y naviera>"}

${resumen}` }],
      });
      const recTexto = recMsg.content[0].type === 'text' ? recMsg.content[0].text : '';
      try {
        const recJson = JSON.parse(recTexto.match(/\{[\s\S]*\}/)?.[0] || '{}');
        recomendadoIndex = recJson.indice ?? -1;
        recomendacion = recJson.razon ?? null;
      } catch { recomendacion = recTexto; }
    }

    return NextResponse.json({ ok: true, resultados, recomendacion, recomendadoIndex, campos: CAMPOS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
