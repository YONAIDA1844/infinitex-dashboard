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
  'eta',
  'flete_maritimo',
  'seguro',
  'gastos_origen',
  'gastos_destino',
  'costo_total',
  'tiempo_transito',
  'validez',
  'observaciones',
];

const PROMPT = `Eres un experto en logística internacional. Se te proporcionará una cotización de flete en PDF.
Extrae exactamente los siguientes campos. Si un campo no está explícito en el documento, coloca null.
Devuelve SOLO un objeto JSON válido con esta estructura exacta, sin texto adicional:

{
  "agente_operador": "nombre del agente de carga u operador logístico que emite la cotización",
  "naviera": "nombre de la naviera propuesta (ej: Maersk, MSC, CMA CGM, Hapag-Lloyd, Evergreen, etc.)",
  "tipo_contenedor": "tipo de contenedor (ej: 40HC, 40', 20', 45HC, LCL, etc.)",
  "incoterm": "condición de venta (ej: FOB, CIF, EXW, CFR, DDP, etc.)",
  "puerto_origen": "nombre del puerto de origen",
  "puerto_destino": "nombre del puerto de destino",
  "etd": "fecha estimada de salida / zarpe (formato: dd/mm/yyyy o como aparece en el documento)",
  "eta": "fecha estimada de llegada al puerto destino (formato: dd/mm/yyyy o como aparece en el documento)",
  "flete_maritimo": "costo del flete marítimo con moneda (ej: USD 2,500)",
  "seguro": "costo del seguro si aplica (ej: USD 150), o null si no incluye",
  "gastos_origen": "cargos en origen: THC, documentación, handling, etc. con moneda",
  "gastos_destino": "cargos en destino: THC, documentación, handling, aduana, etc. con moneda",
  "costo_total": "costo total estimado sumando todos los cargos con moneda",
  "tiempo_transito": "días de tránsito (ej: 28 días, 35 días)",
  "validez": "período o fecha de validez de la cotización",
  "observaciones": "condiciones importantes, restricciones, notas relevantes o servicios incluidos/excluidos"
}`;

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
                    source: {
                      type: 'base64',
                      media_type: 'application/pdf',
                      data: archivo.base64,
                    },
                  },
                  { type: 'text', text: PROMPT },
                ],
              },
            ],
          });

          const texto = msg.content[0].type === 'text' ? msg.content[0].text : '';
          const jsonMatch = texto.match(/\{[\s\S]*\}/);
          const datos = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
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
        `Cotización ${i + 1} (${r.nombre}):
  - Agente: ${r.datos.agente_operador}
  - Naviera: ${r.datos.naviera}
  - Contenedor: ${r.datos.tipo_contenedor}
  - Incoterm: ${r.datos.incoterm}
  - ETD: ${r.datos.etd} | ETA: ${r.datos.eta}
  - Costo total: ${r.datos.costo_total}
  - Tiempo en tránsito: ${r.datos.tiempo_transito}
  - Validez: ${r.datos.validez}`
      ).join('\n\n');

      const recMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: `Eres un experto en logística internacional. Analiza estas cotizaciones de flete y da una recomendación concisa (máximo 4 oraciones) de cuál elegir y por qué. Considera: costo total, tiempo de tránsito, naviera, fechas ETD/ETA y condiciones. Sé específico mencionando cuál cotización (número y agente) recomiendas.

${resumen}

Responde en español.`,
          },
        ],
      });

      recomendacion = recMsg.content[0].type === 'text' ? recMsg.content[0].text : null;
    }

    return NextResponse.json({ ok: true, resultados, recomendacion, campos: CAMPOS });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
