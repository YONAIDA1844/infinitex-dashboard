import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CAMPOS = [
  'proveedor',
  'naviera',
  'puerto_origen',
  'puerto_destino',
  'flete_maritimo',
  'seguro',
  'gastos_origen',
  'gastos_destino',
  'costo_total',
  'tiempo_transito',
  'validez',
  'incoterm',
  'observaciones',
];

const PROMPT = `Eres un experto en logística internacional. Se te proporcionará una cotización de flete en PDF.
Extrae exactamente los siguientes campos. Si un campo no está explícito, déjalo como null.
Devuelve SOLO un objeto JSON válido con esta estructura exacta:

{
  "proveedor": "nombre del forwarder o proveedor logístico",
  "naviera": "nombre de la naviera propuesta",
  "puerto_origen": "puerto de origen",
  "puerto_destino": "puerto de destino",
  "flete_maritimo": "monto en USD o la moneda indicada (ej: USD 1,200)",
  "seguro": "monto del seguro si aplica",
  "gastos_origen": "cargos/gastos en origen",
  "gastos_destino": "cargos/gastos en destino (THC, documentación, etc.)",
  "costo_total": "costo total estimado incluyendo todos los cargos",
  "tiempo_transito": "días de tránsito en número (ej: 28 días)",
  "validez": "fecha o período de validez de la cotización",
  "incoterm": "condición de venta (FOB, CIF, EXW, etc.)",
  "observaciones": "condiciones importantes, restricciones o notas relevantes"
}

No incluyas texto adicional fuera del JSON.`;

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

    // Generar recomendación comparativa
    const exitosas = resultados.filter(r => r.ok && r.datos);
    let recomendacion = null;

    if (exitosas.length >= 2) {
      const resumen = exitosas.map((r, i) =>
        `Cotización ${i + 1} (${r.nombre}): Costo total: ${r.datos.costo_total}, Tiempo: ${r.datos.tiempo_transito}, Naviera: ${r.datos.naviera}`
      ).join('\n');

      const recMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Eres un experto en logística internacional. Basándote en estas cotizaciones, da una recomendación concisa (máximo 3 oraciones) de cuál elegir y por qué. Considera costo, tiempo de tránsito y naviera.\n\n${resumen}\n\nResponde en español.`,
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
