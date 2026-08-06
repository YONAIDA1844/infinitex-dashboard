import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

// Columnas del board "Producción y Trafico" (Monday.com) usadas por el grupo "Trafico 2026"
const COL = {
  ESTADO: 'status',
  DESCRIPCION: 'text_mm4m9gd4',
  NAVIERA: 'texto',
  ORIGEN: 'men__desplegable9',
  ETD: 'date',
  ETA: 'fecha',
  LLEGADA_ANKER: 'fecha9',
  DISPONIBLE_ANKER: 'date_mkzck0x5',
};

// Traduce el "Estado" de Monday a los valores que ya usa InfiniteX. Monday no siempre manda el
// texto exacto esperado (mayúsculas distintas, espacios dobles, sufijos como "PANAMA" pegados al
// nombre del puerto, ej. "EN PUERTO DESTINO  PANAMA"), así que se clasifica por palabra clave en
// vez de exigir una coincidencia exacta. Lo no reconocido se pasa tal cual.
function traducirEstadoMonday(estadoMonday: string): string {
  const s = estadoMonday.toLowerCase();
  if (s.includes('transito') || s.includes('tránsito')) return 'En Transito';
  if (s.includes('destino')) return 'En Puerto Destino';
  if (s.includes('origen')) return 'En Puerto Origen';
  if (s.includes('fabrica') || s.includes('fábrica')) return 'En proceso de carga en fábrica';
  if (s.includes('cotiz')) return 'En cotización';
  if (s.includes('aduana')) return 'En Aduana';
  if (s.includes('liberado')) return 'Liberado';
  if (s.includes('entregado')) return 'Entregado';
  if (s.includes('disponible')) return 'Disponible en Anker';
  return estadoMonday;
}

function colText(columnValues: { id: string; text: string | null }[], id: string): string {
  return columnValues.find(c => c.id === id)?.text?.trim() || '';
}

// Normaliza "2026F| BRI | NOVELTIES  |" -> "2026F | BRI | NOVELTIES" para que el proyecto se vea
// consistente en el reporte, en vez del campo de texto libre (que a veces trae párrafos largos).
function limpiarNombre(name: string): string {
  return name.split('|').map(p => p.trim()).filter(Boolean).join(' | ');
}

// El nombre del ítem sigue el patrón "AÑO+LETRA | INICIALES | CATEGORIA | EMBARQUE N" que ya usan
// los BL cargados manualmente (ej. "2025C | MM | ... | EMBARQUE 4" -> "2025C-MM-EMB4"), para que la
// sincronización reconozca embarques ya existentes en vez de duplicarlos. Si el nombre no sigue ese
// patrón (menos de 2 partes), se usa MONDAY-<id> como respaldo.
function derivarBL(item: { id: string; name: string }): string {
  const partes = item.name.split('|').map(p => p.trim()).filter(Boolean);
  if (partes.length < 2) return `MONDAY-${item.id}`;
  const [anioLetra, iniciales] = partes;
  const embarqueMatch = item.name.match(/EMBARQUE\s*(\d+)/i);
  const numero = embarqueMatch ? embarqueMatch[1] : '1';
  return `${anioLetra}-${iniciales}-EMB${numero}`;
}

async function fetchMondayItems() {
  const boardId = process.env.MONDAY_BOARD_ID;
  const groupId = process.env.MONDAY_GROUP_ID;
  const apiKey = process.env.MONDAY_API_KEY;
  if (!apiKey || !boardId || !groupId) {
    throw new Error('Faltan MONDAY_API_KEY / MONDAY_BOARD_ID / MONDAY_GROUP_ID en las variables de entorno');
  }

  const query = `query {
    boards(ids: [${boardId}]) {
      groups(ids: ["${groupId}"]) {
        items_page(limit: 100) {
          items { id name column_values { id text } }
        }
      }
    }
  }`;

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error('Monday API error: ' + JSON.stringify(json.errors));
  const group = json.data?.boards?.[0]?.groups?.[0];
  if (!group) throw new Error('No se encontró el grupo "Trafico 2026" en el board');
  return group.items_page.items as { id: string; name: string; column_values: { id: string; text: string | null }[] }[];
}

async function supabaseFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal',
      ...(init?.headers || {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const items = await fetchMondayItems();
    let creados = 0, actualizados = 0;
    const errores: string[] = [];
    const plan: { bl: string; item: string; accion: 'crear' | 'actualizar' }[] = [];

    for (const item of items) {
      const bl = derivarBL(item);
      const cv = item.column_values;
      const estadoMonday = colText(cv, COL.ESTADO);

      const camposMonday = {
        descripcion: limpiarNombre(item.name) || colText(cv, COL.DESCRIPCION),
        naviera: colText(cv, COL.NAVIERA),
        origen: colText(cv, COL.ORIGEN),
        etd: colText(cv, COL.ETD) || null,
        eta: colText(cv, COL.ETA) || null,
        llegada_anker: colText(cv, COL.LLEGADA_ANKER) || null,
        fecha_disponible: colText(cv, COL.DISPONIBLE_ANKER) || null,
        ...(estadoMonday ? { estado: traducirEstadoMonday(estadoMonday) } : {}),
      };

      try {
        const existente = await supabaseFetch(`trafico_embarques?bl=eq.${encodeURIComponent(bl)}&select=id`);
        const filas = await existente.json();
        const existe = Array.isArray(filas) && filas.length > 0;

        if (dryRun) {
          plan.push({ bl, item: item.name, accion: existe ? 'actualizar' : 'crear' });
          continue;
        }

        if (existe) {
          await supabaseFetch(`trafico_embarques?id=eq.${filas[0].id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...camposMonday, updated_at: new Date().toISOString() }),
          });
          actualizados++;
        } else {
          await supabaseFetch('trafico_embarques', {
            method: 'POST',
            body: JSON.stringify({
              bl, proveedor: '', incoterm: 'FOB', contenedor: '40HC',
              destino_puerto: 'Manzanillo, Panama', peso_kg: 0, cbm: 0, pallets: 0,
              notas: '', llegada_real: null, proximo_hito: '', riesgo: 'BAJO',
              activo: true, ...camposMonday,
            }),
          });
          creados++;
        }
      } catch (e) {
        errores.push(`${item.name}: ${String(e)}`);
      }
    }

    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, total: items.length, plan });
    return NextResponse.json({ ok: true, total: items.length, creados, actualizados, errores });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
