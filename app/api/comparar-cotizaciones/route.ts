import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CAMPOS = [
  'agente_operador',
  'naviera',
  'tipo_contenedor',
  'incoterm',
  'puerto_origen',
  'puerto_destino',
  'etd',
  'tiempo_transito',
  'eta',
  'flete_maritimo',
  'seguro',
  'gastos_origen',
  'gastos_destino',
  'costo_total',
  'validez',
  'observaciones',
];

const PROMPT = `Eres un experto en logística internacional. Se te proporcionará una cotización de flete en PDF.
Extrae exactamente los siguientes campos. Si un campo no está explícito en el documento, coloca null.

IMPORTANTE: Si el documento indica una fecha ETD (salida) y los días de tránsito, pero NO indica la fecha ETA, DEBES calcularla sumando los días de tránsito a la fecha ETD y colocarla en formato dd/mm/yyyy.

Devuelve SOLO un objeto JSON válido con esta estructura exacta, sin texto adicional:

{
  "agente_operador": "nombre del agente de carga u operador logístico que emite la cotización",
  "naviera": "nombre de la naviera propuesta (ej: Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, etc.)",
  "tipo_contenedor": "tipo de contenedor (ej: 40HC, 40', 20', 45HC, LCL, etc.)",
  "incoterm": "condición de venta (ej: FOB, CIF, EXW, CFR, DDP, etc.)",
  "puerto_origen": "nombre del puerto de origen",
  "puerto_destino": "nombre del puerto de destino",
  "etd": "fecha estimada de salida / zarpe en formato dd/mm/yyyy",
  "tiempo_transito": "número de días de tránsito como texto (ej: 28 días)",
  "eta": "fecha estimada de llegada al puerto destino en formato dd/mm/yyyy. Si no está explícita pero tienes ETD y días de tránsito, CALCÚLALA.",
  "flete_maritimo": "costo del flete marítimo con moneda (ej: USD 2,500)",
  "seguro": "costo del seguro si aplica (ej: USD 150), o null si no incluye",
  "gastos_origen": "cargos en origen: THC, documentación, handling, etc. con moneda",
  "gastos_destino": "cargos en destino: THC, documentación, handling, aduana, etc. con moneda",
  "costo_total": "costo total estimado sumando todos los cargos con moneda",
  "validez": "período o fecha de validez de la cotización",
  "observaciones": "condiciones importantes, restricciones, notas relevantes o servicios incluidos/excluidos"
}`;

function calcularETA(etd: string | null, transitoDias: string | null): string | null {
  if (!etd || !transitoDias) return null;
  const dias = parseInt(transitoDias.replace(/[^0-9]/g, ''));
  if (!dias) return null;
  // Try parsing dd/mm/yyyy
  const parts = etd.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!parts) return null;
  const [, d, m, y] = parts;
  const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
  const fecha = new Date(year, parseInt(m) - 1, parseInt(d));
  fecha.setDate(fecha.getDate() + dias);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()} (calculado)`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { archivos } = body as { archivos: { nombre: string; base64: string }[] };

    if (!archivos || archivos.length < 1) {
      return NextResponse.json({ ok: false, error: 'Se requiere al menos 1 cotización' }, { status: 400 });
    }
    if (archivos.length > 4) {
      return NextResponse.json({ ok: false, error: 'Máximo 4 cotizaciones' }, { status: 400 });
    }

    const resultados = await Promise.all(
      archivos.map(async (archivo) => {
        try {
          const msg = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: archivo.base64 },
                  },
                  { type: 'text', text: PROMPT },
                ],
              },
            ],
          });

          const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
          const jsonMatch = texto.match(/\{[\s\S]*\}/);
          const datos = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

          // Calcular ETA si falta
          if (!datos.eta && datos.etd && datos.tiempo_transito) {
            const etaCalc = calcularETA(datos.etd, datos.tiempo_transito);
            if (etaCalc) datos.eta = etaCalc;
          }

          return { nombre: archivo.nombre, ok: true, datos };
        } catch (e) {
          return { nombre: archivo.nombre, ok: false, datos: null, error: String(e) };
        }
      })
    );

    const exitosas = resultados.filter(r => r.ok && r.datos);
    let recomendacion = null;

    if (exitosas.length >= 2) {
      const resumen = exitosas.map((r, i) =>
        `Cotización ${i + 1} — ${r.datos.agente_operador || r.nombre}:
  Naviera: ${r.datos.naviera} | Contenedor: ${r.datos.tipo_contenedor} | Incoterm: ${r.datos.incoterm}
  ETD: ${r.datos.etd} | ETA: ${r.datos.eta} | Tránsito: ${r.datos.tiempo_transito}
  Costo total: ${r.datos.costo_total} | Flete: ${r.datos.flete_maritimo}
  Validez: ${r.datos.validez}`
      ).join('\n\n');

      const recMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `Eres un experto en logística internacional. Analiza estas ${exitosas.length} cotizaciones y da una recomendación clara (máximo 4 oraciones) indicando cuál es la mejor opción y por qué. Menciona específicamente qué cotización (número y agente) recomiendas, comparando costo total, tiempo en tránsito y fechas ETD/ETA. Responde en español.

${resumen}`,
        }],
      });

      recomendacion = recMsg.content[0].type === 'text' ? recMsg.content[0].text : null;
    }

    return NextResponse.json({ ok: true, resultados, recomendacion, campos: CAMPOS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
