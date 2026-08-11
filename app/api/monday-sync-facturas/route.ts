import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

// Columnas del grupo "Trafico 2026" relacionadas con la factura de flete del
// agente logístico — viven en el mismo board/grupo que ya sincroniza
// monday-sync/route.ts, solo que en columnas que esa sync no traía.
const COL = {
  AGENTE: 'texto',
  COSTO_FLETE: 'n_meros',
  ESTATUS_PAGO: 'tracking_number_bl_mkmp8tey',
  COTIZACIONES: 'archivo_mkmymqf7', // el archivo de factura/cotización de flete vive acá, no en "Factura Definitiva flete"
};

function colText(columnValues: { id: string; text: string | null }[], id: string): string {
  return columnValues.find(c => c.id === id)?.text?.trim() || '';
}

// Igual que en monday-sync/route.ts — debe producir el mismo BL para que la
// factura se enlace con el embarque ya sincronizado, no con uno duplicado.
function derivarBL(item: { id: string; name: string }): string {
  const partes = item.name.split('|').map(p => p.trim()).filter(Boolean);
  if (partes.length < 2) return `MONDAY-${item.id}`;
  const [anioLetra, iniciales] = partes;
  const embarqueMatch = item.name.match(/EMBARQUE\s*(\d+)/i);
  const numero = embarqueMatch ? embarqueMatch[1] : '1';
  return `${anioLetra}-${iniciales}-EMB${numero}`;
}

// El campo "Cotizaciones Logistica" (tipo archivo) es donde vive la factura
// real, no hay un campo de texto limpio con el número — se extrae del primer
// nombre de archivo adjunto (ej. ".../INQ%E2%80%9000276%E2%80%902026...pdf"
// -> "INQ-00276-2026"). Si no hay archivo, se usa un identificador sintético
// basado en el BL para no dejar la factura sin número.
function derivarNumeroFactura(cotizacionesText: string, bl: string): string {
  const primeraUrl = cotizacionesText.split(',')[0]?.trim();
  if (!primeraUrl) return `FLETE-${bl}`;
  try {
    const nombreArchivo = decodeURIComponent(primeraUrl.split('/').pop() || '');
    const sinExtension = nombreArchivo.replace(/\.(pdf|jpg|jpeg|png)$/i, '');
    const match = sinExtension.match(/[A-Z]{2,4}[‐–-]?\d{4,6}[‐–-]?\d{0,4}/i);
    return (match ? match[0] : sinExtension).replace(/[‐–]/g, '-').slice(0, 60) || `FLETE-${bl}`;
  } catch {
    return `FLETE-${bl}`;
  }
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
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
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
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
      ...(init?.headers || {}),
    },
  });
}

export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const items = await fetchMondayItems();
    const proveedoresRes = await supabaseFetch('proveedores?select=id,nombre,tipo');
    const proveedores: any[] = await proveedoresRes.json();
    const agentesPorNombre = new Map(
      (Array.isArray(proveedores) ? proveedores : [])
        .filter(p => p.tipo === 'agente_carga')
        .map(p => [String(p.nombre).trim().toLowerCase(), p])
    );

    let creadas = 0, actualizadas = 0, sinMonto = 0, agentesCreados = 0;
    const errores: string[] = [];
    const plan: any[] = [];

    for (const item of items) {
      const cv = item.column_values;
      const bl = derivarBL(item);
      const agenteNombre = colText(cv, COL.AGENTE);
      const montoText = colText(cv, COL.COSTO_FLETE);
      const estatusTexto = colText(cv, COL.ESTATUS_PAGO).toLowerCase();
      const cotizacionesText = colText(cv, COL.COTIZACIONES);

      if (!montoText || !agenteNombre) { sinMonto++; continue; } // sin costo de flete todavía — nada que sincronizar

      try {
        let agente = agentesPorNombre.get(agenteNombre.trim().toLowerCase());
        if (!agente && !dryRun) {
          const nuevoRes = await supabaseFetch('proveedores', {
            method: 'POST',
            body: JSON.stringify({ nombre: agenteNombre, tipo: 'agente_carga', activo: true }),
          });
          const nuevo = await nuevoRes.json();
          agente = Array.isArray(nuevo) ? nuevo[0] : nuevo;
          if (agente) { agentesPorNombre.set(agenteNombre.trim().toLowerCase(), agente); agentesCreados++; }
        }

        const numeroFactura = derivarNumeroFactura(cotizacionesText, bl);
        const monto = Number(montoText);
        const camposFactura: any = {
          numero_factura: numeroFactura,
          embarque_bl: bl,
          agente_id: agente?.id || null,
          monto,
          moneda: 'USD',
        };
        // Solo el estado "pagado" viene con autoridad de Monday — el resto de
        // los estados (Pendiente/Próxima a vencer/etc.) los decide el motor
        // del Agente de Administración según la fecha de vencimiento, no
        // esta sync, para no pisar un estado que ya esté siendo trabajado.
        if (estatusTexto.includes('pagad')) camposFactura.estado_pago = 'Pagada';

        if (dryRun) {
          plan.push({ bl, agente: agenteNombre, monto, numeroFactura, agenteExistia: !!agente });
          continue;
        }

        const existenteRes = await supabaseFetch(`facturas?embarque_bl=eq.${encodeURIComponent(bl)}&select=id,estado_pago`);
        const existentes = await existenteRes.json();
        const existente = Array.isArray(existentes) && existentes.length > 0 ? existentes[0] : null;

        if (existente) {
          await supabaseFetch(`facturas?id=eq.${existente.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ...camposFactura, updated_at: new Date().toISOString() }),
          });
          actualizadas++;
        } else {
          await supabaseFetch('facturas', {
            method: 'POST',
            body: JSON.stringify({ ...camposFactura, estado_pago: camposFactura.estado_pago || 'Pendiente' }),
          });
          creadas++;
        }
      } catch (e) {
        errores.push(`${item.name}: ${String(e)}`);
      }
    }

    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, total: items.length, plan, sinMonto });
    return NextResponse.json({ ok: true, total: items.length, creadas, actualizadas, sinMonto, agentesCreados, errores });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
