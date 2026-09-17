import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

const BOARD_ID = '7907902981'; // "Pedidos Internacionales"

// Grupos que sí se sincronizan — por pedido explícito del usuario (2026-09-17), solo los pedidos
// ya entregados del año actual. El resto del embudo (nuevos, en proceso, listo para entregar,
// post venta) queda fuera por ahora — ver propuesta del Agente de Ventas, pregunta 1.
const GRUPOS_SYNC: Record<string, string> = {
  grupo_nuevo59394: 'Pedidos Entregados Año Actual 2026',
};

// Columnas reales del board, confirmadas por API el 2026-09-17 (ver propuesta, sección 2).
const COL = {
  RESPONSABLE: 'color_mm0ys7fy',   // llamada "Estado" en Monday, pero son nombres de vendedores
  NUMERO_PEDIDO: 'texto',
  VALOR_PEDIDO: 'n_meros__1',
  PERSONA: 'person',
  FECHA_SOLICITUD: 'date',
  FECHA_ENVIO_AGENTE: 'fecha',
  FECHA_LISTO: 'fecha5',
  FECHA_DESPACHO: 'fecha0',
  ESTADO_PEDIDO: 'status',
  CLIENTE: 'reflejo__1',
};

// Diccionario de la propuesta (sección 4) — traduce las 19 etiquetas reales de Monday a los 8
// estatus operativos del Agente de Ventas. "Despachado" y "En espera de importaciones" no se
// calculan aquí todavía porque no hay dato confiable para distinguirlos (preguntas 4 y 5 de la
// propuesta) — no se inventan, se dejan fuera hasta que se resuelvan esas preguntas.
function traducirEstatusVenta(estadoMonday: string, fechaListo: string, fechaDespacho: string): string {
  const s = (estadoMonday || '').toLowerCase().trim();

  const esProspeccion = ['propuesta enviada', 'volver a llamar', 'seguimiento', 'en negociación', 'en negociacion', 'cita lista', 'sin acción', 'sin accion', 'contacto efectivo'].some(v => s.includes(v));
  if (esProspeccion) return 'Fuera de alcance (prospección)';

  const esAlerta = s.includes('estancado') || s.includes('prox mes') || s.includes('próx mes');
  if (esAlerta) return 'Revisión manual requerida';

  if (s.includes('entregado')) return 'Entregado';
  if (s.includes('lista para entregar') || s.includes('listo para entregar')) {
    // Si ya hay fecha de despacho pero Monday no dice "Entregado", está en tránsito hacia el cliente.
    if (fechaDespacho) return 'En proceso de despacho';
    return 'Preparado';
  }
  if (['pedido recibido', 'pedido x confirmar', 'esperando confirmación', 'esperando confirmacion', 'pendiente'].some(v => s.includes(v))) {
    return 'En verificación';
  }
  if (['por preparar', 'esperando agente', 'esperando oc', 'en logistica', 'en logística', 'en proceso'].some(v => s.includes(v))) {
    // Sin ninguna fecha objetivo cargada, no hay salida definida todavía.
    if (!fechaListo && !fechaDespacho) return 'Sin definir salidas';
    return 'En preparación';
  }

  // Etiqueta no reconocida (o vacía) — no se adivina.
  return 'Revisión manual requerida';
}

function colText(columnValues: { id: string; text: string | null }[], id: string): string {
  return columnValues.find(c => c.id === id)?.text?.trim() || '';
}

async function fetchMondayItems() {
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey) throw new Error('Falta MONDAY_API_KEY en las variables de entorno');

  const groupIds = Object.keys(GRUPOS_SYNC).map(g => `"${g}"`).join(',');
  const query = `query {
    boards(ids: [${BOARD_ID}]) {
      groups(ids: [${groupIds}]) {
        id
        items_page(limit: 100) { items { id name group { id } column_values { id text } } }
      }
    }
  }`;

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error('Monday API error: ' + JSON.stringify(json.errors));

  const groups = json.data?.boards?.[0]?.groups ?? [];
  return groups.flatMap((g: any) => g.items_page.items) as {
    id: string; name: string; group: { id: string }; column_values: { id: string; text: string | null }[];
  }[];
}

async function supabaseFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal,resolution=merge-duplicates',
      ...(init?.headers || {}),
    },
  });
}

export async function POST(_req: NextRequest) {
  try {
    const items = await fetchMondayItems();
    let creados = 0, actualizados = 0;
    const errores: string[] = [];

    for (const item of items) {
      try {
        const cv = item.column_values;
        const estadoMonday = colText(cv, COL.ESTADO_PEDIDO);
        const fechaListo = colText(cv, COL.FECHA_LISTO);
        const fechaDespacho = colText(cv, COL.FECHA_DESPACHO);

        const existente = await supabaseFetch(`pedidos_venta?monday_item_id=eq.${item.id}&select=id`);
        const filas = await existente.json();
        if (!existente.ok) throw new Error(`Supabase (consulta): ${filas?.message || existente.statusText}`);
        const existe = Array.isArray(filas) && filas.length > 0;

        const campos = {
          monday_item_id: item.id,
          monday_group_id: item.group.id,
          numero_pedido: colText(cv, COL.NUMERO_PEDIDO) || null,
          nombre_item: item.name,
          cliente: colText(cv, COL.CLIENTE) || null,
          responsable_comercial: colText(cv, COL.RESPONSABLE) || null,
          valor_pedido: Number(colText(cv, COL.VALOR_PEDIDO)) || null,
          estado_monday: estadoMonday || null,
          estatus_agente: traducirEstatusVenta(estadoMonday, fechaListo, fechaDespacho),
          fecha_solicitud: colText(cv, COL.FECHA_SOLICITUD) || null,
          fecha_envio_agente: colText(cv, COL.FECHA_ENVIO_AGENTE) || null,
          fecha_listo: fechaListo || null,
          fecha_despacho: fechaDespacho || null,
          activo: true,
          updated_at: new Date().toISOString(),
        };

        if (existe) {
          const r = await supabaseFetch(`pedidos_venta?id=eq.${filas[0].id}`, { method: 'PATCH', body: JSON.stringify(campos) });
          if (!r.ok) throw new Error(`Supabase (actualizar): ${(await r.text()) || r.statusText}`);
          actualizados++;
        } else {
          const r = await supabaseFetch('pedidos_venta', { method: 'POST', body: JSON.stringify(campos) });
          if (!r.ok) throw new Error(`Supabase (crear): ${(await r.text()) || r.statusText}`);
          creados++;
        }
      } catch (e) {
        // El detalle completo (puede incluir texto de error de Postgres/Supabase) se registra
        // solo en el log del servidor — al cliente le llega un mensaje corto, sin exponer
        // estructura interna de la base de datos.
        console.error(`[monday-sync-ventas] ${item.name}:`, e);
        errores.push(`${item.name}: no se pudo guardar (ver log del servidor)`);
      }
    }

    return NextResponse.json({ ok: true, total: items.length, creados, actualizados, errores });
  } catch (e) {
    console.error('[monday-sync-ventas]', e);
    return NextResponse.json({ ok: false, error: 'No se pudo sincronizar con Monday.com (ver log del servidor)' }, { status: 500 });
  }
}
