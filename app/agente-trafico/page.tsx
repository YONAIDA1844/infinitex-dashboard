'use client';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

// Combina proveedores de dos fuentes (Odoo y la tabla proveedores de Supabase, donde se
// guardan los agregados a mano) sin que una sobrescriba a la otra — ambas cargan en paralelo
// al montar la página, así que el resultado depende de cuál responda primero. Deduplica por
// nombre (case-insensitive) para no repetir un proveedor que ya exista en ambos lados.
function mergeProveedores(prev: any[], nuevos: any[]): any[] {
  const porNombre = new Map(prev.map((p: any) => [(p.nombre || '').trim().toLowerCase(), p]));
  nuevos.forEach((p: any) => {
    const key = (p.nombre || '').trim().toLowerCase();
    if (key && !porNombre.has(key)) porNombre.set(key, p);
  });
  return [...porNombre.values()].sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));
}

function excelDateToISO(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
  }
  if (typeof val === 'string') {
    const p = val.split('/');
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
    return val;
  }
  return '';
}

const ESTADO_COLORS: Record<string, string> = {
  'En cotización':                  '#a78bfa',
  'Cotizado':                       '#7c3aed',
  'En proceso de carga en fábrica': '#f97316',
  'En Puerto Origen':               '#d29922',
  'En Puerto Destino':              '#0ea5e9',
  'En Transito':                    '#58a6ff',
  'Asignado operador':              '#22d3ee',
  'Arribo a puerto':                '#818cf8',
  'En Aduana':                      '#f59e0b',
  'En Aduana — CRÍTICO':            '#f85149',
  'Liberado':                       '#3fb950',
  'Descargando en bodega':          '#0d9488',
  'Conteo en bodega':               '#ca8a04',
  'Entregado':                      '#8b949e',
  'Disponible en Anker':            '#00d4aa',
};

const EQUIPO = [
  { nombre: 'Daniel Benarroch', email: 'daniel.benarroch@sicobenediciones.com' },
  { nombre: 'Asistente Dirección', email: 'asistente.direccion@sicobenediciones.com' },
  { nombre: 'Asistente Ventas', email: 'asistente.ventas@sicobenediciones.com' },
];

const EMBARQUES_DEMO: any[] = [];

const MESES_WA = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'];
const NUM_EMOJI_WA = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

function formatFechaWA(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T12:00:00Z');
  return `${MESES_WA[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
function abrevBLWA(bl: string): string { const p = bl.split('-'); return p.length >= 2 ? p[1] : bl; }
function numEmbWA(bl: string): string { const p = bl.split('-'); return `Emb. ${p[p.length-1].replace('EMB','')}`;  }
function descCortaWA(d: string): string { return d.replace(/\s*-\s*Embarque\s*\d+\s*$/i,'').trim(); }
function grupoWA(estado: string): 'transito'|'proceso'|'cotizacion' {
  const e = (estado||'').toLowerCase();
  if (e.includes('transito')||e.includes('tránsito')||e.includes('embarcado')) return 'transito';
  if (e.includes('cotizacion')||e.includes('cotización')) return 'cotizacion';
  return 'proceso';
}
function generarTextoWA(embarques: any[]): string {
  const hoy = new Date();
  const fecha = `${hoy.getDate()}/${MESES_WA[hoy.getMonth()]}/${hoy.getFullYear()}`;
  const grupos: Record<string,any[]> = { transito:[], proceso:[], cotizacion:[] };
  embarques.forEach(e => grupos[grupoWA(e.estado)].push(e));
  let idx = 0;
  const lineas: string[] = [`📦 SEGUIMIENTO – TRÁFICO 2026 (${fecha})`, ''];
  const render = (titulo: string, items: any[]) => {
    if (!items.length) return;
    lineas.push(titulo, '');
    items.forEach(e => {
      const num = NUM_EMOJI_WA[idx++] ?? `${idx}.`;
      lineas.push(`${num} ${e.bl} | ${abrevBLWA(e.bl)} | ${descCortaWA(e.descripcion)} | ${numEmbWA(e.bl)}`);
      if (e.etd||e.eta) lineas.push(`· ${[e.etd?`ETD: ${formatFechaWA(e.etd)}`:'',e.eta?`ETA: ${formatFechaWA(e.eta)}`:''].filter(Boolean).join(' · ')}`);
      else lineas.push('· Sin ETD/ETA aún');
      if (e.notas) lineas.push(`· ${e.notas}`);
      lineas.push('');
    });
  };
  render('🚢 EN TRÁNSITO (ya salieron ✓):', grupos.transito);
  render('⚙️ EN PROCESO:', grupos.proceso);
  render('💰 EN COTIZACIÓN:', grupos.cotizacion);
  lineas.push('─────────────────────');
  lineas.push('InfiniteX · Sicoben Ediciones');
  lineas.push('Kadi Internacional S.A.');
  return lineas.join('\n');
}

const FORM_VACIO = {
  bl: '', proveedor: '', naviera: '', incoterm: 'FOB',
  contenedor: '40HC', origen: '', destino_puerto: 'Manzanillo, Panama',
  etd: '', eta: '', peso_kg: '', cbm: '', pallets: '', descripcion: '',
  estado: 'En Puerto Origen',
  doc_bl: false, doc_packing: false, doc_factura: false, doc_permiso: false,
  notas: '',
  llegada_real: '', llegada_anker: '', proximo_hito: '', riesgo: 'BAJO',
};

export default function AgenteTrafico() {
  const FORM_PROVEEDOR_VACIO = {
    nombre: '', pais: 'China', contacto: '', email: '', whatsapp: '', tipo: 'fabricante', notas: '',
  };

  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [embarqueSeleccionado, setEmbarqueSeleccionado] = useState<any>(null);
  const [embarques, setEmbarques] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [panelProveedoresAbierto, setPanelProveedoresAbierto] = useState(false);
  const [formProveedorAbierto, setFormProveedorAbierto] = useState(false);
  const [formProveedor, setFormProveedor] = useState<any>({ ...FORM_PROVEEDOR_VACIO });
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string|null>(null);
  const [form, setForm] = useState<any>({ ...FORM_VACIO });
  const [notifEstado, setNotifEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [notificando, setNotificando] = useState(false);
  const [notificadoBl, setNotificadoBl] = useState('');
  const [importando, setImportando] = useState(false);
  const [previewWA, setPreviewWA] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);
  const [finalizando, setFinalizando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [verReporte, setVerReporte] = useState(false);
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reporteEnviado, setReporteEnviado] = useState(false);
  const [verComparador, setVerComparador] = useState(false);
  const [cotizacionesPDF, setCotizacionesPDF] = useState<{nombre:string;base64:string;size:string}[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [resultadoComparativa, setResultadoComparativa] = useState<any>(null);
  const [errorComparativa, setErrorComparativa] = useState('');
  const [editandoCotizIdx, setEditandoCotizIdx] = useState<number|null>(null);
  const [editCotizForm, setEditCotizForm] = useState<Record<string,string>>({});
  const [embarqueComparador, setEmbarqueComparador] = useState<any>(null);
  const [sincronizandoMonday, setSincronizandoMonday] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reporteIframeRef = useRef<HTMLIFrameElement>(null);
  const [descargandoReporteImg, setDescargandoReporteImg] = useState(false);

  const handleDescargarReporteImagen = async () => {
    const doc = reporteIframeRef.current?.contentDocument;
    const body = doc?.body;
    if (!body) return;
    setDescargandoReporteImg(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(body, { scale: 2, backgroundColor: '#f0f4f8', useCORS: true, windowWidth: body.scrollWidth, windowHeight: body.scrollHeight });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `InfiniteX_Reporte_Diario_${new Date().toISOString().slice(0,10)}.png`;
      a.click();
    } catch (_) {}
    setDescargandoReporteImg(false);
  };

  const handleSincronizarMonday = async () => {
    setSincronizandoMonday(true);
    setNotifEstado('enviando');
    setNotifMsg('Sincronizando embarques desde Monday.com…');
    try {
      const res = await fetch('/api/monday-sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setNotifEstado('ok');
        setNotifMsg(`Monday.com sincronizado: ${data.creados} nuevo(s), ${data.actualizados} actualizado(s) de ${data.total} embarque(s).`);
        fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?activo=eq.true&order=created_at.asc`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        })
          .then(r => r.json())
          .then(rows => {
            if (Array.isArray(rows)) {
              setEmbarques(rows.map((e: any) => ({
                ...e,
                documentos: { bl: e.doc_bl, packing_list: e.doc_packing, factura: e.doc_factura, permiso: e.doc_permiso },
              })));
            }
          })
          .catch(() => {});
      } else {
        setNotifEstado('error');
        setNotifMsg('Error al sincronizar con Monday.com: ' + (data.error || 'desconocido'));
      }
    } catch (e) {
      setNotifEstado('error');
      setNotifMsg('Error al sincronizar con Monday.com: ' + String(e));
    }
    setSincronizandoMonday(false);
  };

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?activo=eq.true&order=created_at.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmbarques(data.map((e: any) => ({
            ...e,
            documentos: { bl: e.doc_bl, packing_list: e.doc_packing, factura: e.doc_factura, permiso: e.doc_permiso },
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?activo=eq.false&order=fecha_disponible.desc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setHistorial(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/proveedores?activo=eq.true&order=nombre.asc`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProveedores(prev => mergeProveedores(prev, data)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/functions/v1/agente-notificador`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'consultar_proveedores', paises: ['China', 'India', 'Spain', 'Mexico', 'España'] }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && Array.isArray(data.proveedores)) {
          const PREFIJOS_INTL = ['+86', '+91', '+34', '+52'];
          const CIUDADES_INTL = ['guangzhou','changsha','shenzhen','ningbo','beijing','shanghai','noida','mumbai','delhi','madrid','barcelona','mexico','guadalajara'];
          const KEYWORDS_INTL = ['CHINA','INDIA','MEXICO','ESPAÑA','SPAIN','SHENZHEN','GUANGZHOU','CHANGSHA','NINGBO','BEIJING','SHANGHAI','NOIDA','MUMBAI','MAMMOTH','JUMBO'];
          const filtered = data.proveedores.filter((p: any) => {
            const phone = (p.phone || '').toLowerCase();
            const city  = (p.city || '').toLowerCase();
            const name  = (p.name || '').toUpperCase();
            return PREFIJOS_INTL.some(x => phone.startsWith(x)) ||
                   CIUDADES_INTL.some(x => city.includes(x)) ||
                   KEYWORDS_INTL.some(x => name.includes(x));
          });
          const mapped = filtered.map((p: any) => ({
            id: p.id,
            nombre: (p.name || '').replace(/&amp;/g, '&'),
            pais: p.city && p.city !== '0' ? p.city : '',
            contacto: p.phone && p.phone !== '0' ? p.phone : '',
            email: p.email && p.email !== '0' ? p.email : '',
            whatsapp: '',
            tipo: 'fabricante',
            notas: '',
          }));
          setProveedores(prev => mergeProveedores(prev, mapped));
        }
      })
      .catch(() => {});
  }, []);

  const embarquesFiltrados = proveedorFiltro
    ? embarques.filter((e) => e.proveedor === proveedorFiltro)
    : embarques;

  // Lista combinada: BD + los que solo existen en embarques locales
  const listaProveedores = proveedores.length > 0 ? proveedores : [];
  const proveedoresExtra = [...new Set(embarques.map((e: any) => e.proveedor).filter(Boolean))]
    .filter(n => !listaProveedores.find((p: any) => p.nombre === n));

  function handleExportar() {
    const rows = embarques.map((e: any) => ({
      'BL / Booking':    e.bl,
      'Estado':          e.estado,
      'Proveedor':       e.proveedor,
      'Naviera':         e.naviera,
      'Contenedor':      e.contenedor,
      'Puerto Origen':   e.origen,
      'Puerto Destino':  e.destino_puerto,
      'ETD (Salida)':    e.etd,
      'ETA (Llegada)':   e.eta,
      'Peso KG':         e.peso_kg,
      'CBM':             e.cbm,
      'Pallets':         e.pallets,
      'Descripcion':     e.descripcion,
      'Notas':           e.notas,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Embarques');
    XLSX.writeFile(wb, `InfiniteX_Embarques_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  async function handleImportar(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImportando(true);
    setNotifMsg('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
      const registros = rows.map((r: any) => ({
        bl:             String(r['BL / Booking'] ?? r['BL'] ?? '').trim().toUpperCase(),
        proveedor:      String(r['Proveedor'] ?? '').trim(),
        naviera:        String(r['Naviera'] ?? '').trim(),
        contenedor:     String(r['Contenedor'] ?? '40HC').trim(),
        origen:         String(r['Puerto Origen'] ?? '').trim(),
        destino_puerto: String(r['Puerto Destino'] ?? '').trim(),
        etd:            excelDateToISO(r['ETD (Salida)'] ?? r['ETD']) || null,
        eta:            excelDateToISO(r['ETA (Llegada)'] ?? r['ETA']) || null,
        estado:         String(r['Estado'] ?? 'En Puerto Origen').trim(),
        peso_kg:        Number(r['Peso KG'] ?? 0),
        cbm:            Number(r['CBM'] ?? 0),
        pallets:        Number(r['Pallets'] ?? 0),
        descripcion:    String(r['Descripcion'] ?? '').trim(),
        notas:          String(r['Notas'] ?? '').trim(),
      })).filter((r: any) => r.bl);

      if (registros.length === 0) {
        setNotifEstado('error');
        setNotifMsg('No se encontraron filas válidas. Verifica que el archivo tenga la columna "BL / Booking".');
        setImportando(false);
        return;
      }

      await fetch(`${SUPABASE_URL}/rest/v1/embarques`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(registros),
      });

      setEmbarques((prev: any[]) => [...registros.map((r: any, i: number) => ({ ...r, id: 'imp-' + Date.now() + i, documentos: {} })), ...prev]);
      setNotifEstado('ok');
      setNotifMsg(`✅ ${registros.length} embarque(s) importado(s) correctamente desde Excel.`);
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('❌ Error al importar: ' + e.message);
    }
    setImportando(false);
    ev.target.value = '';
  }

  async function handleGuardarProveedor() {
    if (!formProveedor.nombre || !formProveedor.pais || !formProveedor.contacto) {
      setNotifEstado('error');
      setNotifMsg('Completa los campos obligatorios: Nombre, País y Contacto.');
      return;
    }
    setGuardandoProveedor(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/proveedores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ ...formProveedor, activo: true }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setProveedores((prev: any[]) => [...prev, data[0]].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setNotifEstado('ok');
        setNotifMsg(`Proveedor "${data[0].nombre}" agregado correctamente.`);
      } else {
        setNotifEstado('error');
        setNotifMsg('Error al guardar el proveedor. Intenta de nuevo.');
      }
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('Error de conexión: ' + e.message);
    }
    setGuardandoProveedor(false);
    setFormProveedorAbierto(false);
    setFormProveedor({ ...FORM_PROVEEDOR_VACIO });
  }

  const handleFormChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleGuardarEmbarque = async () => {
    if (!form.bl || !form.proveedor || !form.eta) {
      setNotifEstado('error');
      setNotifMsg('Completa los campos obligatorios: BL, Proveedor y ETA.');
      return;
    }
    setGuardando(true);
    setNotifEstado('');

    const nuevo = {
      id: editandoId || ('emb-' + Date.now()),
      bl: form.bl.toUpperCase(),
      proveedor: form.proveedor,
      naviera: form.naviera,
      incoterm: form.incoterm,
      contenedor: form.contenedor,
      origen: form.origen,
      destino_puerto: form.destino_puerto,
      etd: form.etd,
      eta: form.eta,
      estado: form.estado,
      peso_kg: Number(form.peso_kg) || 0,
      cbm: Number(form.cbm) || 0,
      pallets: Number(form.pallets) || 0,
      descripcion: form.descripcion,
      documentos: {
        bl: form.doc_bl,
        packing_list: form.doc_packing,
        factura: form.doc_factura,
        permiso: form.doc_permiso,
      },
      notas: form.notas,
      llegada_real: form.llegada_real || null,
      llegada_anker: form.llegada_anker || null,
      proximo_hito: form.proximo_hito || '',
      riesgo: form.riesgo || 'BAJO',
    };

    if (editandoId) {
      setEmbarques((prev: any[]) => prev.map((e: any) => e.id === editandoId ? nuevo : e));
    } else {
      setEmbarques((prev: any[]) => [nuevo, ...prev]);
    }
    setEmbarqueSeleccionado(nuevo);

    const payload = {
      bl: nuevo.bl,
      proveedor: nuevo.proveedor,
      naviera: nuevo.naviera,
      incoterm: nuevo.incoterm,
      contenedor: nuevo.contenedor,
      origen: nuevo.origen,
      destino_puerto: nuevo.destino_puerto,
      etd: nuevo.etd || null,
      eta: nuevo.eta || null,
      estado: nuevo.estado,
      peso_kg: nuevo.peso_kg,
      cbm: nuevo.cbm,
      pallets: nuevo.pallets,
      descripcion: nuevo.descripcion,
      notas: nuevo.notas,
      llegada_real: nuevo.llegada_real || null,
      llegada_anker: nuevo.llegada_anker || null,
      proximo_hito: nuevo.proximo_hito || '',
      riesgo: nuevo.riesgo || 'BAJO',
    };

    try {
      if (editandoId) {
        await fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?id=eq.${editandoId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ ...payload, activo: true }),
        });
      }
    } catch (_) {}

    setNotifEstado('ok');
    setNotifMsg(editandoId ? `Embarque ${nuevo.bl} actualizado correctamente.` : `Embarque ${nuevo.bl} registrado correctamente.`);
    setFormularioAbierto(false);
    setEditandoId(null);
    setForm({ ...FORM_VACIO });
    setGuardando(false);
  };

  const handleNotificarEquipo = async (embarque: any, autoTrigger = false) => {
    if (!embarque || notificando) return;
    setNotificando(true);
    setNotificadoBl('');
    setNotifEstado('enviando');
    setNotifMsg(autoTrigger ? `Cambio de estado detectado — encolando notificación automática...` : `Enviando al Orquestador Central para autorización...`);

    const asunto = `[InfiniteX] BL ${embarque.bl} — Estado: ${embarque.estado}`;
    const mensaje_texto = [
      `📦 ACTUALIZACIÓN DE EMBARQUE — InfiniteX`,
      ``,
      `BL / Booking:   ${embarque.bl}`,
      `Proveedor:      ${embarque.proveedor}`,
      `Estado actual:  ${embarque.estado}`,
      `ETA (Llegada):  ${embarque.eta || 'No definida'}`,
      `Puerto Destino: ${embarque.destino_puerto || '-'}`,
      embarque.descripcion ? `Descripción:    ${embarque.descripcion}` : '',
      embarque.notas ? `⚠ Notas: ${embarque.notas}` : '',
      ``,
      `Generado por Agente de Tráfico — InfiniteX`,
      `Sicoben Ediciones / Kadi Internacional S.A.`,
    ].filter(Boolean).join('\n');

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/message_queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          agent: 'orquestador',
          action: 'notificar_produccion',
          payload: {
            asunto,
            mensaje_texto,
            embarque: {
              bl: embarque.bl,
              proveedor: embarque.proveedor,
              estado: embarque.estado,
              eta: embarque.eta,
              destino_puerto: embarque.destino_puerto,
              descripcion: embarque.descripcion,
              notas: embarque.notas,
            },
            destinatarios: EQUIPO,
            origen: 'agente_trafico',
            automatico: autoTrigger,
          },
          status: 'pending_approval',
          priority: embarque.estado?.includes('CRÍTICO') ? 1 : 5,
        }),
      });
      if (res.ok || res.status === 201) {
        setNotifEstado('ok');
        setNotifMsg(`✅ Notificación de ${embarque.bl} encolada — pendiente de aprobación del Orquestador Central.`);
        setNotificadoBl(embarque.bl);
        setTimeout(() => { setNotificadoBl(''); setNotifMsg(''); setNotifEstado(''); }, 4000);
      } else {
        setNotifEstado('error');
        setNotifMsg(`Error al encolar notificación (${res.status}).`);
        setTimeout(() => { setNotifMsg(''); setNotifEstado(''); }, 5000);
      }
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('Error de conexión: ' + e.message);
      setTimeout(() => { setNotifMsg(''); setNotifEstado(''); }, 5000);
    }
    setNotificando(false);
  };

  const handleFinalizarAnker = async () => {
    if (!embarqueSeleccionado || finalizando) return;
    setFinalizando(true);
    const ahora = new Date().toISOString();
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?id=eq.${embarqueSeleccionado.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ activo: false, estado: 'Disponible en Anker', fecha_disponible: ahora }),
      });
      const finalizado = { ...embarqueSeleccionado, activo: false, estado: 'Disponible en Anker', fecha_disponible: ahora };
      setHistorial((prev: any[]) => [finalizado, ...prev]);
      setEmbarques((prev: any[]) => prev.filter((e: any) => e.id !== embarqueSeleccionado.id));
      setEmbarqueSeleccionado(null);
      setNotifEstado('ok');
      setNotifMsg(`✅ Carga ${finalizado.bl} finalizada — Disponible en Anker.`);
      setTimeout(() => { setNotifMsg(''); setNotifEstado(''); }, 5000);
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('Error al finalizar: ' + e.message);
    }
    setFinalizando(false);
  };

  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (!embarqueSeleccionado || nuevoEstado === embarqueSeleccionado.estado) return;
    const updated = { ...embarqueSeleccionado, estado: nuevoEstado };
    setEmbarqueSeleccionado(updated);
    setEmbarques((prev: any[]) => prev.map((e: any) => e.id === updated.id ? updated : e));

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?id=eq.${updated.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ estado: nuevoEstado, updated_at: new Date().toISOString() }),
      });
    } catch (_) {}

    await handleNotificarEquipo(updated, true);
  };

  const handleAgregarCotizacion = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files || []);
    files.forEach(file => {
      if (cotizacionesPDF.length >= 4) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        const size = (file.size / 1024).toFixed(0) + ' KB';
        setCotizacionesPDF(prev => prev.length < 4 ? [...prev, { nombre: file.name, base64, size }] : prev);
      };
      reader.readAsDataURL(file);
    });
    ev.target.value = '';
  };

  const handleDescargarReporteCotizaciones = async () => {
    const el = document.getElementById('reporte-cotizaciones');
    if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#f0f4f8', useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let yPos = 0;
    while (yPos < imgH) {
      if (yPos > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH);
      yPos += pageH;
      if (imgH - yPos < 5) break; // evitar página casi vacía al final
    }
    pdf.save(`InfiniteX_Comparativa_Cotizaciones_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handleAnalizarCotizaciones = async () => {
    if (cotizacionesPDF.length < 1) return;
    setAnalizando(true);
    setErrorComparativa('');
    setResultadoComparativa(null);
    try {
      const res = await fetch('/api/comparar-cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos: cotizacionesPDF.map(c => ({ nombre: c.nombre, base64: c.base64 })) }),
      });
      const data = await res.json();
      if (data.ok) {
        setResultadoComparativa(data);
      } else {
        setErrorComparativa(data.error || 'Error al analizar las cotizaciones');
      }
    } catch (e: any) {
      setErrorComparativa('Error de conexión. Intenta de nuevo.');
    }
    setAnalizando(false);
  };

  const ETIQUETAS_CAMPOS: Record<string, string> = {
    agente_operador: 'Agente / Operador Logístico',
    naviera: 'Naviera',
    tipo_contenedor: 'Tipo de Contenedor',
    incoterm: 'Incoterm',
    puerto_origen: 'Puerto Origen',
    puerto_destino: 'Puerto Destino',
    etd: 'ETD — Fecha de Salida',
    eta: 'ETA — Fecha de Llegada',
    flete_maritimo: 'Flete Marítimo',
    seguro: 'Seguro',
    gastos_origen: 'Gastos en Origen',
    gastos_destino: 'Gastos en Destino',
    costo_total: 'Costo Total',
    tiempo_transito: 'Tiempo en Tránsito',
    validez: 'Validez',
    observaciones: 'Observaciones',
  };

  const generarHTMLReporte = () => {
    const MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const MESES_C = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'];
    const fmt = (d: string|null) => { if(!d) return '-'; const dt=d.includes('T')?new Date(d):new Date(d+'T12:00:00Z'); if(isNaN(dt.getTime())) return '-'; return MESES_C[dt.getUTCMonth()]+' '+dt.getUTCDate(); };
    const fmtLarga = (d: string|null) => { if(!d) return '-'; const dt=d.includes('T')?new Date(d):new Date(d+'T12:00:00Z'); if(isNaN(dt.getTime())) return '-'; return `${dt.getUTCDate()} de ${MESES_L[dt.getUTCMonth()]} de ${dt.getUTCFullYear()}`; };
    const hoy = new Date();
    const fecha = `${hoy.getDate()} de ${MESES_L[hoy.getMonth()]} de ${hoy.getFullYear()}`;
    const hoyISO = hoy.toISOString().slice(0,10);

    // Emojis (ya diseñados profesionalmente, se ven bien en cualquier navegador) en vez de SVG
    // dibujado a mano, que no se leía con claridad como barco/grúa/etc.
    const icon = (kind: string, _color: string, size = 26) => {
      const emoji: Record<string,string> = {
        ship: '🚢', crane: '🏗️', building: '🏭', document: '📄', anchor: '⚓',
        unloading: '📦', checklist: '📋',
        calendarCheck: '📅', calendarSmall: '📅', binoculars: '🔭', megaphone: '📣',
      };
      return `<span style="font-size:${size}px;line-height:1;display:inline-block;">${emoji[kind] || ''}</span>`;
    };

    const estadoCorto = (estado: string) => {
      const s = (estado||'').toLowerCase();
      if (s.includes('transito')||s.includes('tránsito')) return 'EN TRÁNSITO';
      if (s.includes('destino')) return 'EN PUERTO DESTINO';
      if (s.includes('origen')||s.includes('puerto')) return 'EN PUERTO DE ORIGEN';
      if (s.includes('fábrica')||s.includes('fabrica')) return 'CARGANDO EN FÁBRICA';
      if (s.includes('cotiz')) return 'EN COTIZACIÓN';
      if (s.includes('descarg')) return 'DESCARGANDO EN BODEGA';
      if (s.includes('conteo')) return 'CONTEO EN BODEGA';
      if (s.includes('disponible')) return 'DISPONIBLE EN ANKER';
      if (s.includes('liberado')) return 'LIBERADO';
      if (s.includes('aduana')) return 'EN ADUANA';
      if (s.includes('entregado')) return 'ENTREGADO';
      return (estado||'-').toUpperCase();
    };
    const eStyle = (e: string) => { const ev=(e||'').toLowerCase(); if(ev.includes('transito')||ev.includes('tránsito')) return {bg:'#d6eaff',color:'#1f6feb'}; if(ev.includes('destino')) return {bg:'#d6f3fd',color:'#0284c7'}; if(ev.includes('origen')||ev.includes('puerto')) return {bg:'#ffe4c2',color:'#d9730d'}; if(ev.includes('fábrica')||ev.includes('fabrica')) return {bg:'#d6e0f5',color:'#2f4b8f'}; if(ev.includes('cotizaci')) return {bg:'#fad2e3',color:'#c81e5c'}; if(ev.includes('descarg')) return {bg:'#ccfbf1',color:'#0d9488'}; if(ev.includes('conteo')) return {bg:'#fef3c7',color:'#ca8a04'}; if(ev.includes('liberado')||ev.includes('listo')) return {bg:'#c8f2da',color:'#1a9e5c'}; if(ev.includes('aduana')) return {bg:'#fbd4d2',color:'#c0261f'}; if(ev.includes('disponible')) return {bg:'#c8f2da',color:'#1a9e5c'}; return {bg:'#e4e7eb',color:'#4a5568'}; };
    const riesgoColor = (r: string) => { if(r==='ALTO') return {bg:'rgba(248,81,73,0.12)',color:'#f85149',dot:'#f85149'}; if(r==='MEDIO') return {bg:'rgba(210,153,34,0.12)',color:'#d29922',dot:'#f1b000'}; return {bg:'rgba(63,185,80,0.12)',color:'#3fb950',dot:'#3fb950'}; };
    // El estado es la única fuente confiable de si un embarque ya salió de origen o ya llegó a
    // destino (Monday no manda fechas reales de zarpe/arribo) — se infiere por las etapas
    // posteriores del flujo: transito+ ya salió; puerto destino+ ya llegó.
    const yaSalioOrigen = (estado: string) => { const s=(estado||'').toLowerCase(); return s.includes('transito')||s.includes('tránsito')||s.includes('destino')||s.includes('descarg')||s.includes('conteo')||s.includes('aduana')||s.includes('liberado')||s.includes('entregado')||s.includes('disponible'); };
    const yaLlegoDestino = (estado: string) => { const s=(estado||'').toLowerCase(); return s.includes('destino')||s.includes('descarg')||s.includes('conteo')||s.includes('aduana')||s.includes('liberado')||s.includes('entregado')||s.includes('disponible'); };
    const check = (si: boolean) => si ? '<span style="color:#1a9e5c;font-weight:800;">✓</span>' : '<span style="color:#a0aec0;">-</span>';

    const cambioHoy = (e: any) => !!(e.updated_at && String(e.updated_at).slice(0,10) === hoyISO);
    const hayCambios = embarques.some(cambioHoy);

    const enTransito      = embarques.filter((e: any) => { const s=(e.estado||'').toLowerCase(); return s.includes('transito')||s.includes('tránsito'); });
    const enPuertoDestino = embarques.filter((e: any) => (e.estado||'').toLowerCase().includes('destino'));
    const enPuertoOrigen  = embarques.filter((e: any) => { const s=(e.estado||'').toLowerCase(); return (s.includes('origen')||s.includes('puerto'))&&!s.includes('destino'); });
    const cargandoFabrica = embarques.filter((e: any) => { const s=(e.estado||'').toLowerCase(); return s.includes('fábrica')||s.includes('fabrica'); });
    const enCotizacion    = embarques.filter((e: any) => (e.estado||'').toLowerCase().includes('cotiz'));
    const descargandoBodega = embarques.filter((e: any) => (e.estado||'').toLowerCase().includes('descarg'));
    const conteoBodega    = embarques.filter((e: any) => (e.estado||'').toLowerCase().includes('conteo'));
    const disponibleAnker = embarques.filter((e: any) => (e.estado||'').toLowerCase().includes('disponible'));

    const calcHito = (e: any) => { const s=(e.estado||'').toLowerCase(); if(s.includes('fábrica')||s.includes('fabrica')||s.includes('cotiz')) return 'Asignado operador'; if(e.llegada_anker) return `Llegada a Anker (${fmt(e.llegada_anker)})`; return '-'; };
    const enAnkerAhora = (e: any) => !!(e.llegada_anker && e.llegada_anker <= hoyISO);

    const proximosAnker = embarques
      .filter((e: any) => e.llegada_anker)
      .sort((a: any,b: any) => a.llegada_anker.localeCompare(b.llegada_anker));
    const proximaCarga = proximosAnker[0];

    const grupoLlegadas: Record<string, any[]> = {};
    [...enTransito, ...enPuertoOrigen, ...enPuertoDestino].forEach((e: any) => { if (e.llegada_anker) (grupoLlegadas[e.llegada_anker] ||= []).push(e); });
    const accionesLista: {icono: string; texto: string}[] = [];
    Object.keys(grupoLlegadas).sort().slice(0,2).forEach(f => {
      const items = grupoLlegadas[f];
      const nombres = items.map((e: any) => e.descripcion||e.bl).join(' y ');
      accionesLista.push({ icono: 'binoculars', texto: `Dar seguimiento a la llegada de ${nombres} que ${items.length>1?'llegarán':'llegará'} a Anker el ${fmtLarga(f)}.` });
    });
    enPuertoOrigen.forEach((e: any) => accionesLista.push({ icono: 'building', texto: `Confirmar con el proveedor el estado de ${e.descripcion||e.bl} en puerto de origen.` }));
    cargandoFabrica.forEach((e: any) => accionesLista.push({ icono: 'building', texto: `Dar seguimiento al avance de carga de ${e.descripcion||e.bl} para confirmar ETA.` }));
    if (enTransito.length) accionesLista.push({ icono: 'document', texto: 'Revisar documentación pendiente (BL, factura, packing list, etc.) de las cargas en tránsito.' });
    const accionesFinal = accionesLista.slice(0,6);

    const filasTabla = embarques.map((e: any) => {
      const es=eStyle(e.estado), r=riesgoColor(e.riesgo||'BAJO'), cambio=cambioHoy(e);
      return `<tr style="border-bottom:1px solid #e8edf2;"><td style="padding:10px 12px;font-size:12px;color:#1a2332;font-weight:600;white-space:nowrap;">${e.descripcion||e.bl||'-'}</td><td style="padding:10px 12px;white-space:nowrap;"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${es.bg};color:${es.color};white-space:nowrap;">${estadoCorto(e.estado)}</span></td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${fmt(e.etd)}</td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${fmt(e.eta)}</td><td style="padding:10px 12px;font-size:12px;text-align:center;white-space:nowrap;">${check(yaSalioOrigen(e.estado))}</td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${e.llegada_real ? fmt(e.llegada_real) : check(yaLlegoDestino(e.estado))}</td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${fmt(e.llegada_anker)}</td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${enAnkerAhora(e)?'Sí':'-'}</td><td style="padding:10px 12px;font-size:12px;color:#4a5568;text-align:center;white-space:nowrap;">${fmt(e.fecha_disponible)}</td><td style="padding:10px 12px;font-size:12px;color:#2d3748;white-space:nowrap;">${calcHito(e)}</td><td style="padding:10px 12px;text-align:center;white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${r.bg};color:${r.color};"><span style="width:7px;height:7px;border-radius:50%;background:${r.dot};display:inline-block;"></span>${e.riesgo||'BAJO'}</span></td><td style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:${cambio?'#d29922':'#3fb950'};white-space:nowrap;">${cambio?'● CAMBIO':'✓ SIN CAMBIOS'}</td></tr>`;
    }).join('');
    const tarjetasProximos = proximosAnker.map((e: any) => {
      const dt=new Date(e.llegada_anker+'T12:00:00Z');
      return `<div style="background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:10px;border-left:3px solid #3498db;box-shadow:0 1px 4px rgba(0,0,0,0.06);display:flex;align-items:center;gap:12px;"><div style="background:#e8f4fd;border-radius:6px;padding:6px 10px;text-align:center;flex-shrink:0;"><div style="font-size:15px;font-weight:800;color:#3498db;line-height:1;">${String(dt.getUTCDate()).padStart(2,'0')}</div><div style="font-size:9px;font-weight:700;color:#3498db;text-transform:uppercase;">${MESES_L[dt.getUTCMonth()].substring(0,3)}</div></div><div><div style="font-size:12px;font-weight:700;color:#1a2332;">${e.descripcion||e.bl}</div><div style="font-size:11px;color:#718096;margin-top:2px;">Llegada Anker: ${fmtLarga(e.llegada_anker)}</div></div></div>`;
    }).join('') || '<div style="color:#a0aec0;font-size:12px;padding:10px;">Sin próximas llegadas registradas</div>';
    const tarjetasAcciones = accionesFinal.map(a =>
      `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #e8edf2;"><div style="flex-shrink:0;margin-top:1px;">${icon(a.icono,'#3498db',18)}</div><div style="font-size:12px;color:#2d3748;line-height:1.5;">${a.texto}</div></div>`
    ).join('') || '<div style="color:#a0aec0;font-size:12px;padding:10px;">Sin acciones pendientes</div>';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:20px 10px;"><tr><td align="center">
<table width="1150" cellpadding="0" cellspacing="0" style="max-width:1150px;width:100%;">
<tr><td style="background:#ffffff;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:3px solid #1a2332;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="top"><div style="font-size:26px;font-weight:800;color:#1a2332;letter-spacing:0.5px;">SEGUIMIENTO DIARIO DE IMPORTACIONES</div>
      <div style="font-size:15px;font-weight:700;color:#27ae60;margin-top:4px;">TRÁFICO 2026</div></td>
    <td align="right" valign="top">
      <table cellpadding="0" cellspacing="0" style="display:inline-table;background:#eef3f8;border:1px solid #d7e3ee;border-radius:8px;"><tr>
        <td style="padding:8px 10px 8px 12px;">${icon('calendarSmall','#1a2332',18)}</td>
        <td style="padding:8px 14px 8px 4px;text-align:left;"><div style="font-size:9px;color:#718096;letter-spacing:1px;font-weight:700;">FECHA DEL REPORTE</div><div style="font-size:12px;font-weight:800;color:#1a2332;">${fecha.toUpperCase()}</div></td>
      </tr></table>
      <div style="margin-top:8px;"><span style="display:inline-block;background:${hayCambios?'#fff7e6':'#e8f8ee'};border:1px solid ${hayCambios?'#f1b000':'#3fb950'};border-radius:6px;padding:6px 12px;font-size:11px;font-weight:800;color:${hayCambios?'#d29922':'#27ae60'};">${hayCambios?'⚠ CAMBIOS DETECTADOS HOY':'✓ SIN CAMBIOS RESPECTO AL DÍA ANTERIOR'}</span></div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="background:#fff;padding:20px 32px 10px;border-bottom:2px solid #e8edf2;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:25%;text-align:center;padding:0 6px 12px;"><div style="background:#fad2e3;border-radius:10px;padding:14px 6px;">${icon('document','#c81e5c',28)}<div style="font-size:26px;font-weight:800;color:#c81e5c;margin-top:4px;">${enCotizacion.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">En Cotización</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px 12px;"><div style="background:#d6e0f5;border-radius:10px;padding:14px 6px;">${icon('building','#2f4b8f',28)}<div style="font-size:26px;font-weight:800;color:#2f4b8f;margin-top:4px;">${cargandoFabrica.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">Cargando en Fábrica</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px 12px;"><div style="background:#ffe4c2;border-radius:10px;padding:14px 6px;">${icon('crane','#d9730d',28)}<div style="font-size:26px;font-weight:800;color:#d9730d;margin-top:4px;">${enPuertoOrigen.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">En Puerto de Origen</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px 12px;"><div style="background:#d6eaff;border-radius:10px;padding:14px 6px;">${icon('ship','#1f6feb',28)}<div style="font-size:26px;font-weight:800;color:#1f6feb;margin-top:4px;">${enTransito.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">En Tránsito</div></div></td>
  </tr><tr>
    <td style="width:25%;text-align:center;padding:0 6px;"><div style="background:#d6f3fd;border-radius:10px;padding:14px 6px;">${icon('anchor','#0284c7',28)}<div style="font-size:26px;font-weight:800;color:#0284c7;margin-top:4px;">${enPuertoDestino.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">En Puerto Destino</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px;"><div style="background:#ccfbf1;border-radius:10px;padding:14px 6px;">${icon('unloading','#0d9488',28)}<div style="font-size:26px;font-weight:800;color:#0d9488;margin-top:4px;">${descargandoBodega.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">Descargando en Bodega</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px;"><div style="background:#fef3c7;border-radius:10px;padding:14px 6px;">${icon('checklist','#ca8a04',28)}<div style="font-size:26px;font-weight:800;color:#ca8a04;margin-top:4px;">${conteoBodega.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">Conteo en Bodega</div></div></td>
    <td style="width:25%;text-align:center;padding:0 6px;"><div style="background:#c8f2da;border-radius:10px;padding:14px 6px;">${icon('calendarCheck','#1a9e5c',28)}<div style="font-size:26px;font-weight:800;color:#1a9e5c;margin-top:4px;">${disponibleAnker.length}</div><div style="font-size:9px;color:#4a5568;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;">Disponible en Anker</div></div></td>
  </tr></table>
</td></tr>
<tr><td style="background:#fff;padding:0;">
  <div style="padding:20px 32px 10px;"><div style="font-size:11px;font-weight:700;color:#3498db;letter-spacing:2px;text-transform:uppercase;">DETALLE DE EMBARQUES</div></div>
  <div style="overflow-x:auto;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:1160px;">
    <thead><tr style="background:#eaf3fd;border-bottom:2px solid #1f6feb;">
      <th style="padding:10px 12px;text-align:left;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">PROYECTO</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">ESTADO</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">ETD</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">ETA</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">SALIÓ</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">LLEGÓ</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">LLEGADA ANKER</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">EN ANKER</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">DISPONIBLE ANKER</th>
      <th style="padding:10px 12px;text-align:left;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">PRÓXIMO HITO</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">RIESGO</th>
      <th style="padding:10px 12px;text-align:center;font-size:10px;color:#718096;letter-spacing:1px;text-transform:uppercase;font-weight:700;">CAMBIO VS DÍA ANTERIOR</th>
    </tr></thead>
    <tbody>${filasTabla}</tbody>
  </table></div>
</td></tr>
<tr><td style="background:#f7f9fc;padding:20px 32px;border-top:2px solid #e8edf2;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr valign="top">
    <td style="width:28%;padding-right:14px;">
      <div style="background:#1a2332;border-radius:6px 6px 0 0;padding:8px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">RESUMEN GENERAL</div>
      <div style="background:#fff;border-radius:0 0 8px 8px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#1f6feb;">&#9679;</span> ${enTransito.length} embarque(s) en tránsito.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#d9730d;">&#9679;</span> ${enPuertoOrigen.length} embarque(s) en puerto de origen.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#0284c7;">&#9679;</span> ${enPuertoDestino.length} embarque(s) en puerto de destino.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#2f4b8f;">&#9679;</span> ${cargandoFabrica.length} embarque(s) cargando en fábrica.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#c81e5c;">&#9679;</span> ${enCotizacion.length} embarque(s) en cotización.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#0d9488;">&#9679;</span> ${descargandoBodega.length} embarque(s) descargando en bodega.</div>
        <div style="font-size:12px;color:#4a5568;margin-bottom:8px;"><span style="color:#ca8a04;">&#9679;</span> ${conteoBodega.length} embarque(s) en conteo en bodega.</div>
        <div style="font-size:12px;color:#4a5568;"><span style="color:#1a9e5c;">&#9679;</span> ${disponibleAnker.length} embarque(s) disponible(s) en Anker.</div>
      </div>
      ${proximaCarga ? `<div style="background:#eef3fb;border-radius:8px;padding:12px 14px;margin-top:12px;font-size:11px;color:#2d3748;line-height:1.5;"><strong>La carga más próxima a llegar a Anker es:</strong><br/>${proximaCarga.descripcion||proximaCarga.bl}<br/>Fecha estimada de llegada: ${fmtLarga(proximaCarga.llegada_anker)}</div>` : ''}
    </td>
    <td style="width:36%;padding:0 8px;">
      <div style="background:#1a6b45;border-radius:6px;padding:8px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">PRÓXIMAS LLEGADAS A ANKER</div>
      ${tarjetasProximos}
    </td>
    <td style="width:36%;padding-left:16px;">
      <div style="background:#1a2332;border-radius:6px 6px 0 0;padding:8px 12px;font-size:11px;font-weight:700;color:#fff;letter-spacing:1px;text-transform:uppercase;">ACCIONES RECOMENDADAS PARA HOY</div>
      <div style="background:#fff;border-radius:0 0 8px 8px;padding:10px 14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">${tarjetasAcciones}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="background:#f0f4f8;padding:14px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:24px;">${icon('megaphone','#4a5568',20)}</td>
    <td style="font-size:11px;color:#4a5568;padding-left:8px;">NOTA: Este seguimiento se actualizará diariamente con la información más reciente de estatus y cambios en las fechas.</td>
    <td align="right" style="font-size:11px;color:#4a5568;white-space:nowrap;padding-left:12px;">${hayCambios?'Hoy hay cambios respecto al día anterior.':'Hoy no hay cambios respecto al día anterior.'}</td>
  </tr></table>
</td></tr>
<tr><td style="background:#1a2332;border-radius:0 0 12px 12px;padding:16px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:11px;color:#7fb3d3;">KADI INTERNACIONAL S.A. · SICOBEN EDICIONES</div>
      <div style="font-size:10px;color:#4a6280;margin-top:2px;">Generado automáticamente por InfiniteX · ${fecha}</div></td>
    <td align="right"><div style="font-size:16px;font-weight:800;letter-spacing:2px;"><span style="color:#58a6ff;">INFINITE</span><span style="color:#4a6280;"> X</span></div></td>
  </tr></table>
</td></tr>
</table></td></tr></table></body></html>`;
  };

  const handleEnviarReporte = async () => {
    setEnviandoReporte(true);
    setReporteEnviado(false);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agente-notificador`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'reporte_diario' }),
      });
      const data = await res.json();
      if (data.ok) { setReporteEnviado(true); setTimeout(() => setReporteEnviado(false), 5000); }
    } catch (_) {}
    setEnviandoReporte(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d1117', border: '1px solid #21262d',
    borderRadius: 6, color: '#e6edf3', padding: '8px 10px', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 4, display: 'block',
  };

  const GlobeSmall = () => (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <defs>
        <radialGradient id="hgat" cx="38%" cy="35%" r="65%"><stop offset="0%" stopColor="#1a3a5c"/><stop offset="100%" stopColor="#0a1628"/></radialGradient>
        <clipPath id="hcat"><circle cx="40" cy="40" r="34"/></clipPath>
        <filter id="hglowat"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="40" cy="40" r="34" fill="url(#hgat)"/>
      <g clipPath="url(#hcat)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.7" fill="none">
        <ellipse cx="40" cy="40" rx="34" ry="10"/><ellipse cx="40" cy="40" rx="34" ry="22"/><ellipse cx="40" cy="40" rx="34" ry="32"/>
        <line x1="40" y1="6" x2="40" y2="74"/><ellipse cx="40" cy="40" rx="17" ry="34"/><ellipse cx="40" cy="40" rx="28" ry="34"/>
      </g>
      <g clipPath="url(#hcat)" stroke="#6eaadf" strokeWidth="0.9" fill="none" strokeOpacity="0.4">
        <path d="M22 32 Q32 14 50 22"/><path d="M50 22 Q62 28 58 44"/><path d="M14 42 Q18 36 22 32"/>
      </g>
      <g filter="url(#hglowat)">
        <circle cx="22" cy="32" r="2.8" fill="#7bbcf0"/><circle cx="50" cy="22" r="2.5" fill="#7bbcf0"/>
        <circle cx="58" cy="44" r="2.5" fill="#7bbcf0"/><circle cx="14" cy="42" r="2" fill="#7bbcf0"/>
      </g>
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(110,170,223,0.35)" strokeWidth="1"/>
    </svg>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d1421', color: '#e2eaf6', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64, gap: 16, backgroundColor: '#0d1421', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobeSmall />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: 1, color: '#e2eaf6' }}>
              Infinite<span style={{ color: '#5ba3e0' }}>X</span>
            </div>
            <div style={{ fontSize: 10, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase' }}>Sistema Logístico</div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)', margin: '0 8px' }}/>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#5ba3e0', letterSpacing: 1, textTransform: 'uppercase' }}>Agente de Tráfico</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/" style={{ color: '#4a6280', fontSize: 13, textDecoration: 'none', fontWeight: 400 }}>← Dashboard</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3aaa6e', boxShadow: '0 0 7px #3aaa6e', display: 'inline-block' }}/>
            <span style={{ color: '#3aaa6e', fontSize: 12, fontWeight: 500 }}>Operativo</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: '#8b949e', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>PANEL DE SUPERVISION</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Agente de Trafico</h1>
          <p style={{ color: '#8b949e', fontSize: 14, marginTop: 4 }}>Monitoreo de embarques en transito — Sicoben Ediciones</p>
        </div>

        {/* Notificacion global */}
        {notifMsg && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
            background: notifEstado === 'error' ? 'rgba(248,81,73,0.12)' : notifEstado === 'enviando' ? 'rgba(88,166,255,0.1)' : 'rgba(63,185,80,0.12)',
            border: `1px solid ${notifEstado === 'error' ? '#f85149' : notifEstado === 'enviando' ? '#58a6ff' : '#3fb950'}`,
            color: notifEstado === 'error' ? '#f85149' : notifEstado === 'enviando' ? '#58a6ff' : '#3fb950',
            fontSize: 13,
          }}>
            {notifEstado === 'enviando' ? '⏳ ' : notifEstado === 'error' ? '❌ ' : '✅ '}{notifMsg}
          </div>
        )}

        {/* BOTONES PRINCIPALES */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => { setFormularioAbierto(!formularioAbierto); setEditandoId(null); setForm({...FORM_VACIO}); setNotifMsg(''); }}
            style={{
              background: formularioAbierto ? '#21262d' : '#58a6ff',
              color: formularioAbierto ? '#e6edf3' : '#0d1117',
              border: 'none', borderRadius: 8, padding: '10px 22px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {formularioAbierto ? '✕ Cancelar' : '+ Cargar Nuevo Embarque'}
          </button>
          <button
            onClick={handleExportar}
            style={{
              background: 'transparent', color: '#8b949e',
              border: '1px solid #21262d', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            ↓ Exportar Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
            style={{
              background: 'rgba(63,185,80,0.1)', color: '#3fb950',
              border: '1px solid #3fb95044', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: importando ? 'not-allowed' : 'pointer', opacity: importando ? 0.6 : 1,
            }}
          >
            {importando ? 'Importando…' : '↑ Importar Excel'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportar} />
          <button
            onClick={() => { setPanelProveedoresAbierto(!panelProveedoresAbierto); setNotifMsg(''); }}
            style={{
              background: panelProveedoresAbierto ? '#21262d' : 'rgba(167,139,250,0.12)',
              color: panelProveedoresAbierto ? '#e6edf3' : '#a78bfa',
              border: `1px solid ${panelProveedoresAbierto ? '#21262d' : '#a78bfa44'}`,
              borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer',
            }}
          >
            🏭 Gestionar Proveedores ({proveedores.length})
          </button>
          <button
            onClick={() => setPreviewWA(true)}
            style={{
              background: 'rgba(37,211,102,0.1)', color: '#25d366',
              border: '1px solid #25d36644', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >
            📱 Preview WhatsApp
          </button>
          <button
            onClick={() => setVerReporte(true)}
            style={{
              background: 'rgba(88,166,255,0.12)', color: '#58a6ff',
              border: '1px solid #58a6ff44', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >
            📊 Ver Reporte Diario
          </button>
          <button
            onClick={() => { setVerComparador(true); setTimeout(() => document.getElementById('comparador-cotizaciones')?.scrollIntoView({ behavior: 'smooth' }), 150); }}
            style={{
              background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
              border: '1px solid #a78bfa44', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >
            📄 Comparar Cotizaciones
          </button>
          <button
            onClick={handleSincronizarMonday}
            disabled={sincronizandoMonday}
            style={{
              background: 'rgba(0,120,212,0.12)', color: '#0086c9',
              border: '1px solid #0086c944', borderRadius: 8, padding: '10px 18px',
              fontSize: 13, cursor: sincronizandoMonday ? 'not-allowed' : 'pointer', fontWeight: 600,
              opacity: sincronizandoMonday ? 0.6 : 1,
            }}
          >
            {sincronizandoMonday ? '⏳ Sincronizando…' : '🔄 Sincronizar desde Monday'}
          </button>
        </div>

        {/* PANEL DE GESTIÓN DE PROVEEDORES */}
        {panelProveedoresAbierto && (
          <div style={{
            background: '#161b22', border: '1px solid #a78bfa55', borderRadius: 12,
            padding: 24, marginBottom: 28,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#a78bfa', fontWeight: 600 }}>
                🏭 Gestión de Proveedores
              </h3>
              <button
                onClick={() => { setFormProveedorAbierto(!formProveedorAbierto); setFormProveedor({ ...FORM_PROVEEDOR_VACIO }); }}
                style={{
                  background: formProveedorAbierto ? '#21262d' : 'rgba(167,139,250,0.15)',
                  color: '#a78bfa', border: '1px solid #a78bfa44',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                }}
              >
                {formProveedorAbierto ? '✕ Cancelar' : '+ Agregar Proveedor'}
              </button>
            </div>

            {/* Formulario agregar proveedor */}
            {formProveedorAbierto && (
              <div style={{
                background: '#0d1117', border: '1px solid #a78bfa33',
                borderRadius: 10, padding: 20, marginBottom: 20,
              }}>
                <p style={{ fontSize: 11, color: '#a78bfa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
                  DATOS DEL NUEVO PROVEEDOR
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Nombre / Empresa *</label>
                    <input style={inputStyle} placeholder="Ej: ANKER INNOVATIONS"
                      value={formProveedor.nombre}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, nombre: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>País *</label>
                    <input style={inputStyle} placeholder="Ej: China"
                      value={formProveedor.pais}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, pais: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo</label>
                    <select style={inputStyle} value={formProveedor.tipo}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, tipo: e.target.value }))}>
                      <option value="fabricante">Fabricante</option>
                      <option value="agente_carga">Agente de Carga</option>
                      <option value="distribuidor">Distribuidor</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Nombre de Contacto *</label>
                    <input style={inputStyle} placeholder="Ej: Li Wei"
                      value={formProveedor.contacto}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, contacto: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} placeholder="contacto@empresa.com"
                      value={formProveedor.email}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>WhatsApp</label>
                    <input style={inputStyle} placeholder="+86 755 8888 0001"
                      value={formProveedor.whatsapp}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, whatsapp: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={labelStyle}>Notas</label>
                    <input style={inputStyle} placeholder="Observaciones sobre el proveedor..."
                      value={formProveedor.notas}
                      onChange={e => setFormProveedor((p: any) => ({ ...p, notas: e.target.value }))} />
                  </div>
                </div>
                <button
                  onClick={handleGuardarProveedor}
                  disabled={guardandoProveedor}
                  style={{
                    marginTop: 16, background: guardandoProveedor ? '#21262d' : '#a78bfa',
                    color: guardandoProveedor ? '#8b949e' : '#0d1117',
                    border: 'none', borderRadius: 8, padding: '10px 28px',
                    fontSize: 14, fontWeight: 700, cursor: guardandoProveedor ? 'not-allowed' : 'pointer',
                  }}
                >
                  {guardandoProveedor ? 'Guardando...' : '✓ Guardar Proveedor'}
                </button>
              </div>
            )}

            {/* Tabla de proveedores */}
            {proveedores.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: 13, padding: 20, textAlign: 'center',
                border: '1px dashed #21262d', borderRadius: 8 }}>
                No hay proveedores registrados. Agrega el primero con el botón de arriba.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #21262d' }}>
                      {['Nombre / Empresa', 'País', 'Tipo', 'Contacto', 'Email', 'WhatsApp', 'Notas'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left', fontSize: 10,
                          color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proveedores.map((p: any, i: number) => (
                      <tr key={p.id} style={{
                        borderBottom: '1px solid #21262d11',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#e6edf3' }}>{p.nombre}</td>
                        <td style={{ padding: '10px 12px', color: '#8b949e' }}>{p.pais}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 20,
                            background: p.tipo === 'fabricante' ? 'rgba(88,166,255,0.12)' : 'rgba(63,185,80,0.12)',
                            color: p.tipo === 'fabricante' ? '#58a6ff' : '#3fb950',
                            border: `1px solid ${p.tipo === 'fabricante' ? '#58a6ff33' : '#3fb95033'}`,
                          }}>
                            {p.tipo === 'fabricante' ? 'Fabricante' : p.tipo === 'agente_carga' ? 'Ag. Carga' : p.tipo === 'distribuidor' ? 'Distribuidor' : p.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#e6edf3' }}>{p.contacto || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#58a6ff' }}>
                          {p.email ? <a href={`mailto:${p.email}`} style={{ color: '#58a6ff', textDecoration: 'none' }}>{p.email}</a> : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#3fb950' }}>{p.whatsapp || '-'}</td>
                        <td style={{ padding: '10px 12px', color: '#8b949e', maxWidth: 200,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notas || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* FORMULARIO DESPLEGABLE */}
        {formularioAbierto && (
          <div style={{
            background: '#161b22', border: '1px solid #58a6ff', borderRadius: 12,
            padding: 24, marginBottom: 28,
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 16, color: '#58a6ff', fontWeight: 600 }}>
              {editandoId ? '✏ Editando Embarque' : '📋 Datos del Nuevo Embarque'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {/* BL */}
              <div>
                <label style={labelStyle}>BL / Booking # *</label>
                <input style={inputStyle} placeholder="Ej: MAEU123456789"
                  value={form.bl} onChange={e => handleFormChange('bl', e.target.value)} />
              </div>
              {/* Proveedor */}
              <div>
                <label style={labelStyle}>Proveedor *</label>
                <select style={inputStyle} value={form.proveedor} onChange={e => handleFormChange('proveedor', e.target.value)}>
                  <option value="">-- Seleccionar proveedor --</option>
                  {listaProveedores.map((p: any) => (
                    <option key={p.id} value={p.nombre}>{p.nombre}{p.pais ? ` (${p.pais})` : ''}</option>
                  ))}
                  {proveedoresExtra.map((n: any) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              {/* Naviera */}
              <div>
                <label style={labelStyle}>Naviera</label>
                <input style={inputStyle} placeholder="Ej: Maersk, CMA CGM..."
                  value={form.naviera} onChange={e => handleFormChange('naviera', e.target.value)} />
              </div>
              {/* Incoterm */}
              <div>
                <label style={labelStyle}>Incoterm</label>
                <select style={inputStyle} value={form.incoterm} onChange={e => handleFormChange('incoterm', e.target.value)}>
                  {['FOB','CIF','EXW','DAP','DDP','CFR','FCA'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {/* Contenedor */}
              <div>
                <label style={labelStyle}>Tipo de Contenedor</label>
                <select style={inputStyle} value={form.contenedor} onChange={e => handleFormChange('contenedor', e.target.value)}>
                  {['20ST','40ST','40HC','LCL','Aereo'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Estado */}
              <div>
                <label style={labelStyle}>Estado</label>
                <select style={inputStyle} value={form.estado} onChange={e => handleFormChange('estado', e.target.value)}>
                  {Object.keys(ESTADO_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Origen */}
              <div>
                <label style={labelStyle}>Puerto Origen</label>
                <input style={inputStyle} placeholder="Ej: Shanghai, China"
                  value={form.origen} onChange={e => handleFormChange('origen', e.target.value)} />
              </div>
              {/* Destino */}
              <div>
                <label style={labelStyle}>Puerto Destino</label>
                <input style={inputStyle} placeholder="Ej: Manzanillo, Panama"
                  value={form.destino_puerto} onChange={e => handleFormChange('destino_puerto', e.target.value)} />
              </div>
              {/* ETD */}
              <div>
                <label style={labelStyle}>ETD (Salida)</label>
                <input type="date" style={inputStyle}
                  value={form.etd} onChange={e => handleFormChange('etd', e.target.value)} />
              </div>
              {/* ETA */}
              <div>
                <label style={labelStyle}>ETA (Llegada) *</label>
                <input type="date" style={inputStyle}
                  value={form.eta} onChange={e => handleFormChange('eta', e.target.value)} />
              </div>
              {/* Peso */}
              <div>
                <label style={labelStyle}>Peso (KG)</label>
                <input type="number" style={inputStyle} placeholder="Ej: 18500"
                  value={form.peso_kg} onChange={e => handleFormChange('peso_kg', e.target.value)} />
              </div>
              {/* CBM */}
              <div>
                <label style={labelStyle}>Volumen (CBM)</label>
                <input type="number" style={inputStyle} placeholder="Ej: 42.3"
                  value={form.cbm} onChange={e => handleFormChange('cbm', e.target.value)} />
              </div>
              {/* Pallets */}
              <div>
                <label style={labelStyle}>Pallets</label>
                <input type="number" style={inputStyle} placeholder="Ej: 18"
                  value={form.pallets} onChange={e => handleFormChange('pallets', e.target.value)} />
              </div>
              {/* Descripcion */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Descripcion de Carga</label>
                <input style={inputStyle} placeholder="Ej: Cargadores, cables y accesorios electronicos"
                  value={form.descripcion} onChange={e => handleFormChange('descripcion', e.target.value)} />
              </div>
            </div>

            {/* Documentos */}
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <label style={labelStyle}>Documentos Recibidos</label>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {[
                  { key: 'doc_bl', label: 'BL / AWB' },
                  { key: 'doc_packing', label: 'Packing List' },
                  { key: 'doc_factura', label: 'Factura Comercial' },
                  { key: 'doc_permiso', label: 'Permisos/Certificados' },
                ].map(doc => (
                  <label key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form[doc.key]}
                      onChange={e => handleFormChange(doc.key, e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#58a6ff' }} />
                    {doc.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Notas */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notas / Observaciones</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                placeholder="Observaciones importantes del embarque..."
                value={form.notas} onChange={e => handleFormChange('notas', e.target.value)} />
            </div>

            {/* Campos para reporte diario */}
            <div style={{ borderTop: '1px solid rgba(0,212,170,0.2)', paddingTop: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: '#00d4aa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
                📊 DATOS PARA REPORTE DIARIO
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Llegada Real (puerto)</label>
                  <input type="date" style={inputStyle}
                    value={form.llegada_real} onChange={e => handleFormChange('llegada_real', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Llegada a Anker</label>
                  <input type="date" style={inputStyle}
                    value={form.llegada_anker} onChange={e => handleFormChange('llegada_anker', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Próximo Hito</label>
                  <input style={inputStyle} placeholder="Ej: Llegada a Anker ago. 11"
                    value={form.proximo_hito} onChange={e => handleFormChange('proximo_hito', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Nivel de Riesgo</label>
                  <select style={inputStyle} value={form.riesgo} onChange={e => handleFormChange('riesgo', e.target.value)}>
                    <option value="BAJO">🟢 BAJO</option>
                    <option value="MEDIO">🟡 MEDIO</option>
                    <option value="ALTO">🔴 ALTO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Boton guardar */}
            <button
              onClick={handleGuardarEmbarque}
              disabled={guardando}
              style={{
                background: guardando ? '#21262d' : '#3fb950', color: guardando ? '#8b949e' : '#0d1117',
                border: 'none', borderRadius: 8, padding: '10px 28px',
                fontSize: 14, fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer',
              }}
            >
              {guardando ? 'Guardando...' : '✓ Guardar Embarque'}
            </button>
          </div>
        )}

        {/* Filtro proveedor y lista */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24 }}>
          <div>
            {/* Filtro */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>FILTRAR POR PROVEEDOR</label>
              <select
                style={{ ...inputStyle, padding: '10px 12px' }}
                value={proveedorFiltro}
                onChange={e => setProveedorFiltro(e.target.value)}
              >
                <option value="">Todos los proveedores</option>
                {listaProveedores.map((p: any) => (
                  <option key={p.id} value={p.nombre}>{p.nombre}{p.pais ? ` (${p.pais})` : ''}</option>
                ))}
                {proveedoresExtra.map((n: any) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Lista embarques */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, color: '#8b949e', textTransform: 'uppercase', marginBottom: 12 }}>
                EMBARQUES ACTIVOS ({embarquesFiltrados.length})
              </p>
              {embarquesFiltrados.length === 0 && (
                <div style={{ color: '#8b949e', fontSize: 13, padding: 20, textAlign: 'center',
                  border: '1px dashed #21262d', borderRadius: 8 }}>Sin embarques para este proveedor</div>
              )}
              {embarquesFiltrados.map(emb => (
                <div key={emb.id}
                  onClick={() => { setEmbarqueSeleccionado(emb); setNotifMsg(''); }}
                  style={{
                    background: embarqueSeleccionado?.id === emb.id ? '#1c2333' : '#161b22',
                    border: embarqueSeleccionado?.id === emb.id ? '1px solid #58a6ff' : '1px solid #21262d',
                    borderRadius: 8, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                    borderLeft: embarqueSeleccionado?.id === emb.id ? '3px solid #58a6ff' : '1px solid #21262d',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>BL: {emb.bl}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20,
                      background: (ESTADO_COLORS[emb.estado] || '#8b949e') + '22',
                      color: ESTADO_COLORS[emb.estado] || '#8b949e',
                      border: `1px solid ${ESTADO_COLORS[emb.estado] || '#8b949e'}44`,
                    }}>{emb.estado}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 4 }}>{emb.proveedor}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#8b949e' }}>
                    <span>ETA: <span style={{ color: '#e6edf3' }}>{emb.eta}</span></span>
                    <span>Cont: <span style={{ color: '#e6edf3' }}>{emb.contenedor}</span></span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNotificarEquipo(emb); }}
                    disabled={notificando}
                    style={{
                      marginTop: 10, width: '100%',
                      background: notificadoBl === emb.bl ? 'rgba(63,185,80,0.15)' : notificando ? 'rgba(88,166,255,0.04)' : 'rgba(88,166,255,0.07)',
                      color: notificadoBl === emb.bl ? '#3fb950' : notificando ? '#58a6ff88' : '#58a6ff',
                      border: `1px solid ${notificadoBl === emb.bl ? '#3fb95055' : '#58a6ff33'}`,
                      borderRadius: 6, padding: '6px 0', fontSize: 12,
                      cursor: notificando ? 'not-allowed' : 'pointer', fontWeight: 600, letterSpacing: 0.5,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {notificando && notificadoBl === '' ? '⏳ Enviando...' : notificadoBl === emb.bl ? '✅ Encolado' : '🔔 Notificar a Producción'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Panel detalle */}
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 24, minHeight: 400 }}>
            {!embarqueSeleccionado ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 300, color: '#8b949e', gap: 12 }}>
                <span style={{ fontSize: 48 }}>📦</span>
                <span style={{ fontSize: 14 }}>Selecciona un embarque para ver el detalle</span>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{embarqueSeleccionado.bl}</h2>
                      <span style={{
                        fontSize: 12, padding: '3px 12px', borderRadius: 20, marginTop: 6, display: 'inline-block',
                        background: (ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e') + '22',
                        color: ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e',
                        border: `1px solid ${ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e'}44`,
                      }}>{embarqueSeleccionado.estado}</span>
                    </div>
                    <button
                      onClick={() => {
                        const e = embarqueSeleccionado;
                        setForm({
                          bl: e.bl, proveedor: e.proveedor || '', naviera: e.naviera || '',
                          incoterm: e.incoterm || 'FOB', contenedor: e.contenedor || '40HC',
                          origen: e.origen || '', destino_puerto: e.destino_puerto || 'Manzanillo, Panama',
                          etd: e.etd || '', eta: e.eta || '', peso_kg: e.peso_kg || '',
                          cbm: e.cbm || '', pallets: e.pallets || '', descripcion: e.descripcion || '',
                          estado: e.estado || 'En Puerto Origen',
                          doc_bl: e.documentos?.bl || false, doc_packing: e.documentos?.packing_list || false,
                          doc_factura: e.documentos?.factura || false, doc_permiso: e.documentos?.permiso || false,
                          notas: e.notas || '', llegada_real: e.llegada_real || '',
                          llegada_anker: e.llegada_anker || '', proximo_hito: e.proximo_hito || '',
                          riesgo: e.riesgo || 'BAJO',
                        });
                        setEditandoId(e.id);
                        setFormularioAbierto(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: 'rgba(88,166,255,0.1)', color: '#58a6ff',
                        border: '1px solid #58a6ff44', borderRadius: 8,
                        padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      ✏ Editar
                    </button>
                  </div>
                  {/* Actualizar estado + Notificar */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase' }}>Actualizar estado:</span>
                      <select
                        value={embarqueSeleccionado.estado}
                        onChange={e => handleCambiarEstado(e.target.value)}
                        style={{
                          background: '#0d1117', border: '1px solid #30363d',
                          borderRadius: 6, color: '#e6edf3', padding: '6px 10px',
                          fontSize: 13, cursor: 'pointer', outline: 'none',
                        }}
                      >
                        {Object.keys(ESTADO_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => handleNotificarEquipo(embarqueSeleccionado)}
                      disabled={notificando}
                      style={{
                        background: notificadoBl === embarqueSeleccionado?.bl ? '#3fb950' : notificando ? '#21262d' : '#58a6ff',
                        color: notificando ? '#8b949e' : '#0d1117',
                        border: 'none', borderRadius: 8,
                        padding: '8px 18px', fontSize: 13,
                        cursor: notificando ? 'not-allowed' : 'pointer', fontWeight: 700,
                        transition: 'all 0.3s ease', minWidth: 180,
                      }}
                    >
                      {notificando ? '⏳ Enviando...' : notificadoBl === embarqueSeleccionado?.bl ? '✅ Encolado' : '🔔 Notificar a Producción'}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#8b949e', marginTop: 6, marginBottom: 0 }}>
                    Al cambiar el estado o hacer clic en Notificar, la solicitud pasa al Orquestador Central para autorización antes de enviarse.
                  </p>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={handleFinalizarAnker}
                      disabled={finalizando}
                      style={{
                        background: finalizando ? '#21262d' : 'linear-gradient(135deg, #00d4aa22, #00d4aa11)',
                        color: finalizando ? '#8b949e' : '#00d4aa',
                        border: '1px solid #00d4aa55',
                        borderRadius: 8, padding: '10px 22px',
                        fontSize: 13, fontWeight: 700, cursor: finalizando ? 'not-allowed' : 'pointer',
                        letterSpacing: 0.5,
                      }}
                    >
                      {finalizando ? '⏳ Finalizando...' : '✦ Marcar Disponible en Anker'}
                    </button>
                    <p style={{ fontSize: 11, color: '#00d4aa88', marginTop: 6, marginBottom: 0 }}>
                      Mueve esta carga al historial de finalizadas. Acción irreversible.
                    </p>
                  </div>
                </div>

                {/* Equipo que recibe notificacion */}
                <div style={{ background: 'rgba(88,166,255,0.06)', border: '1px solid #58a6ff22',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12 }}>
                  <span style={{ color: '#58a6ff', fontWeight: 600, letterSpacing: 1 }}>EQUIPO PRODUCCION — Notificados:</span>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                    {EQUIPO.map(p => (
                      <span key={p.email} style={{ color: '#8b949e' }}>
                        {p.nombre} <span style={{ color: '#58a6ff' }}>({p.email})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Datos principales */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {[
                    ['Proveedor', embarqueSeleccionado.proveedor],
                    ['Naviera', embarqueSeleccionado.naviera],
                    ['Incoterm', embarqueSeleccionado.incoterm],
                    ['Contenedor', embarqueSeleccionado.contenedor],
                    ['Puerto Origen', embarqueSeleccionado.origen],
                    ['Puerto Destino', embarqueSeleccionado.destino_puerto],
                    ['ETD (Salida)', embarqueSeleccionado.etd],
                    ['ETA (Llegada)', embarqueSeleccionado.eta],
                    ['Peso', embarqueSeleccionado.peso_kg ? embarqueSeleccionado.peso_kg.toLocaleString() + ' kg' : '-'],
                    ['Volumen', embarqueSeleccionado.cbm ? embarqueSeleccionado.cbm + ' CBM' : '-'],
                    ['Pallets', embarqueSeleccionado.pallets || '-'],
                    ['Descripcion', embarqueSeleccionado.descripcion],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: '#0d1117', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{val || '-'}</div>
                    </div>
                  ))}
                </div>

                {/* Documentos */}
                {embarqueSeleccionado.documentos && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, color: '#8b949e', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>DOCUMENTOS</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        ['BL / AWB', embarqueSeleccionado.documentos.bl],
                        ['Packing List', embarqueSeleccionado.documentos.packing_list],
                        ['Factura Comercial', embarqueSeleccionado.documentos.factura],
                        ['Permisos', embarqueSeleccionado.documentos.permiso],
                      ].map(([doc, ok]) => (
                        <div key={doc as string} style={{
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                          padding: '8px 12px', borderRadius: 6,
                          background: ok ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
                          border: `1px solid ${ok ? '#3fb95033' : '#f8514933'}`,
                        }}>
                          <span style={{ color: ok ? '#3fb950' : '#f85149' }}>{ok ? '✓' : '✗'}</span>
                          <span style={{ color: ok ? '#3fb950' : '#f85149' }}>{doc as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                {embarqueSeleccionado.notas && (
                  <div style={{
                    background: 'rgba(210,153,34,0.08)', border: '1px solid #d2992233',
                    borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                  }}>
                    <p style={{ fontSize: 11, color: '#d29922', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>⚠ NOTAS</p>
                    <p style={{ fontSize: 13, color: '#e6edf3', margin: 0 }}>{embarqueSeleccionado.notas}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPARADOR DE COTIZACIONES */}
      <div id="comparador-cotizaciones" style={{ maxWidth: 1400, margin: '32px auto 0', padding: '0 32px' }}>
        <button
          onClick={() => setVerComparador(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: '#161b22', border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: verComparador ? '10px 10px 0 0' : 10, padding: '14px 20px',
            cursor: 'pointer', color: '#a78bfa', fontSize: 14, fontWeight: 600, textAlign: 'left',
            marginBottom: verComparador ? 0 : 8,
          }}
        >
          <span style={{ fontSize: 18 }}>📄</span>
          Comparador de Cotizaciones IA
          <span style={{
            background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: 11, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.3)',
          }}>{cotizacionesPDF.length}/4 cargadas</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8b949e' }}>{verComparador ? '▲ Ocultar' : '▼ Abrir'}</span>
        </button>

        {verComparador && (
          <div style={{
            background: '#161b22', border: '1px solid rgba(167,139,250,0.25)',
            borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 24,
          }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8b949e', lineHeight: 1.6 }}>
              Carga hasta <strong style={{ color: '#a78bfa' }}>4 cotizaciones en PDF</strong>. El agente IA extrae los mismos campos de cada una y genera una tabla comparativa con recomendación.
            </p>

            {/* Selector de embarque en cotización */}
            {(() => {
              const enCotizacion = embarques.filter(e =>
                (e.estado || '').toLowerCase().includes('cotizaci')
              );
              if (enCotizacion.length === 0) return null;
              return (
                <div style={{ marginBottom: 20, background: '#0d1117', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    ¿Para qué embarque es esta comparativa?
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {enCotizacion.map((e: any) => {
                      const sel = embarqueComparador?.id === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setEmbarqueComparador(sel ? null : e)}
                          style={{
                            background: sel ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.05)',
                            border: `1px solid ${sel ? '#a78bfa' : 'rgba(167,139,250,0.2)'}`,
                            borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                            textAlign: 'left', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 700, color: sel ? '#a78bfa' : '#e6edf3' }}>{e.descripcion}</div>
                          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
                            {e.bl} &nbsp;·&nbsp; {e.proveedor || 'Sin proveedor'}
                            {e.origen && <> &nbsp;·&nbsp; {e.origen} → {e.destino || 'PTY'}</>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {embarqueComparador && (
                    <div style={{ marginTop: 10, fontSize: 11, color: '#3fb950' }}>
                      ✓ Comparando cotizaciones para: <strong>{embarqueComparador.descripcion}</strong>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Zona de carga */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              {cotizacionesPDF.map((c, i) => (
                <div key={i} style={{
                  background: '#0d1117', border: '1px solid rgba(167,139,250,0.35)',
                  borderRadius: 10, padding: '12px 16px', minWidth: 180, maxWidth: 220,
                  display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
                }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, wordBreak: 'break-all' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>{c.size}</div>
                  <button
                    onClick={() => setCotizacionesPDF(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 8, right: 8, background: 'rgba(248,81,73,0.15)',
                      border: 'none', color: '#f85149', borderRadius: 4, width: 22, height: 22,
                      cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                </div>
              ))}

              {cotizacionesPDF.length < 4 && (
                <label style={{
                  background: 'rgba(167,139,250,0.05)', border: '2px dashed rgba(167,139,250,0.3)',
                  borderRadius: 10, padding: '20px 24px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  minWidth: 160, transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 28, opacity: 0.7 }}>+</span>
                  <span style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center' }}>Agregar cotización PDF</span>
                  <input
                    type="file" accept=".pdf" multiple
                    style={{ display: 'none' }}
                    onChange={handleAgregarCotizacion}
                  />
                </label>
              )}
            </div>

            {/* Botón analizar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
              <button
                onClick={handleAnalizarCotizaciones}
                disabled={analizando || cotizacionesPDF.length < 1}
                style={{
                  background: analizando ? '#21262d' : 'linear-gradient(135deg,#a78bfa22,#a78bfa11)',
                  color: analizando ? '#8b949e' : '#a78bfa',
                  border: '1px solid #a78bfa55', borderRadius: 8,
                  padding: '10px 24px', fontSize: 14, fontWeight: 700,
                  cursor: analizando || cotizacionesPDF.length < 1 ? 'not-allowed' : 'pointer',
                  opacity: cotizacionesPDF.length < 1 ? 0.5 : 1, transition: 'all 0.2s',
                }}
              >
                {analizando ? '⏳ Analizando con IA...' : '✦ Analizar y Comparar'}
              </button>
              {cotizacionesPDF.length > 0 && (
                <button
                  onClick={() => { setCotizacionesPDF([]); setResultadoComparativa(null); setErrorComparativa(''); }}
                  style={{ background: 'none', border: '1px solid #30363d', borderRadius: 8, color: '#8b949e', padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}
                >
                  Limpiar todo
                </button>
              )}
            </div>

            {/* Error */}
            {errorComparativa && (
              <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f8514933', borderRadius: 8, padding: '12px 16px', color: '#f85149', fontSize: 13, marginBottom: 20 }}>
                ❌ {errorComparativa}
              </div>
            )}

            {/* RESULTADOS — TABLA FILAS=COTIZACIONES */}
            {resultadoComparativa && (() => {
              const rows = resultadoComparativa.resultados;
              const rec  = resultadoComparativa.recomendadoIndex ?? -1;
              const COLS = [
                { key: 'agente_operador', label: 'NOMBRE DEL OPERADOR' },
                { key: 'monto_display',   label: 'MONTO'               },
                { key: 'tiempo_transito', label: 'DÍAS DE TRÁNSITO'     },
                { key: 'naviera',         label: 'NAVIERA'              },
                { key: 'tipo_contenedor', label: 'TIPO CONTENEDOR'      },
                { key: 'etd',             label: 'SALIDA (ETD)'         },
                { key: 'eta',             label: 'LLEGADA (ETA)'        },
                { key: 'dias_libres',     label: 'DÍAS LIBRES'          },
                { key: 'incoterm',        label: 'INCOTERM'             },
                { key: 'validez',         label: 'VALIDEZ'              },
              ];
              const CAMPOS_EDIT = [
                { key: 'agente_operador', label: 'Agente / Operador',        hint: 'Ej: Anker Logística' },
                { key: 'costo_total',     label: '💰 MONTO TOTAL',           hint: 'Ej: USD 4,500.00'   },
                { key: 'tiempo_transito', label: 'Días de Tránsito',         hint: 'Ej: 31 días'        },
                { key: 'naviera',         label: 'Naviera',                  hint: 'Ej: Maersk Line'    },
                { key: 'tipo_contenedor', label: 'Tipo Contenedor',          hint: 'Ej: 40HC'           },
                { key: 'etd',             label: 'Salida ETD',               hint: 'Ej: 15/07/2026'     },
                { key: 'eta',             label: 'Llegada ETA',              hint: 'Ej: 15/08/2026'     },
                { key: 'dias_libres',     label: 'Días Libres',              hint: 'Ej: 30 días libres' },
                { key: 'incoterm',        label: 'Incoterm',                 hint: 'Ej: FOB'            },
                { key: 'validez',         label: 'Validez',                  hint: 'Ej: 15/07/2026'     },
                { key: 'flete_maritimo',  label: 'Flete Marítimo',           hint: 'Ej: USD 3,200'      },
                { key: 'gastos_origen',   label: 'Gastos Origen',            hint: 'Ej: USD 450'        },
                { key: 'gastos_destino',  label: 'Gastos Destino',           hint: 'Ej: USD 850'        },
                { key: 'observaciones',   label: 'Observaciones',            hint: 'Condiciones, notas' },
              ];
              const thStyle: React.CSSProperties = {
                padding: '11px 14px', textAlign: 'center', fontSize: 10,
                color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase',
                fontWeight: 700, whiteSpace: 'nowrap', background: '#1e3a5f',
                borderRight: '1px solid rgba(255,255,255,0.1)',
              };

              const handleAbrirEdicion = (i: number) => {
                const d = rows[i]?.datos || {};
                setEditCotizForm({ ...d });
                setEditandoCotizIdx(i);
              };
              const handleGuardarEdicion = () => {
                if (editandoCotizIdx === null) return;
                setResultadoComparativa((prev: any) => {
                  const nuevos = [...prev.resultados];
                  nuevos[editandoCotizIdx] = { ...nuevos[editandoCotizIdx], datos: { ...editCotizForm } };
                  return { ...prev, resultados: nuevos };
                });
                setEditandoCotizIdx(null);
              };

              return (
                <div>
                  {/* BARRA DE ACCIONES — siempre visible */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ fontSize: 12, color: '#8b949e', fontWeight: 600 }}>
                      📊 {rows.length} cotización(es) · {rec >= 0 ? `Recomendada: #${rec+1}` : 'Análisis listo'}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleDescargarReporteCotizaciones} style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d4a6e)', color: '#58a6ff', border: '1px solid #58a6ff55', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⬇ PDF
                      </button>
                      <button onClick={async () => {
                        const el = document.getElementById('reporte-cotizaciones');
                        if (!el) return;
                        const { default: h2c } = await import('html2canvas');
                        const canvas = await h2c(el, { scale: 2, backgroundColor: '#f0f4f8', useCORS: true });
                        const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
                        a.download = `InfiniteX_Comparativa_${new Date().toISOString().slice(0,10)}.png`; a.click();
                      }} style={{ background: 'linear-gradient(135deg,#1a3d1a,#1e4d2a)', color: '#3fb950', border: '1px solid #3fb95055', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🖼 Imagen
                      </button>
                    </div>
                  </div>

                  {/* MODAL EDITAR COTIZACIÓN */}
                  {editandoCotizIdx !== null && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 14, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#e6edf3' }}>✏ Editar Cotización #{editandoCotizIdx + 1}</div>
                            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 3 }}>{rows[editandoCotizIdx]?.nombre}</div>
                          </div>
                          <button onClick={() => setEditandoCotizIdx(null)} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {CAMPOS_EDIT.map(({ key, label, hint }) => {
                            const esMonto = key === 'costo_total';
                            const esObs   = key === 'observaciones';
                            return (
                              <div key={key} style={{ gridColumn: esObs ? '1 / -1' : undefined }}>
                                <label style={{ display: 'block', fontSize: 10, color: esMonto ? '#58a6ff' : '#8b949e', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
                                {esObs ? (
                                  <textarea
                                    value={editCotizForm[key] || ''}
                                    onChange={e => setEditCotizForm(p => ({ ...p, [key]: e.target.value }))}
                                    rows={3}
                                    style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '8px 10px', color: '#e6edf3', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={editCotizForm[key] || ''}
                                    onChange={e => setEditCotizForm(p => ({ ...p, [key]: e.target.value }))}
                                    placeholder={hint}
                                    style={{ width: '100%', background: esMonto ? '#0a1628' : '#0d1117', border: `1px solid ${esMonto ? '#58a6ff55' : '#30363d'}`, borderRadius: 6, padding: '8px 10px', color: esMonto ? '#58a6ff' : '#e6edf3', fontSize: esMonto ? 14 : 13, fontWeight: esMonto ? 700 : 400, boxSizing: 'border-box' }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditandoCotizIdx(null)} style={{ background: 'none', border: '1px solid #30363d', borderRadius: 8, color: '#8b949e', padding: '9px 20px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={() => {
                            if (editandoCotizIdx === null) return;
                            const formActual = editCotizForm;
                            setResultadoComparativa((prev: any) => {
                              const nuevos = [...prev.resultados];
                              nuevos[editandoCotizIdx] = { ...nuevos[editandoCotizIdx], datos: { ...formActual } };
                              return { ...prev, resultados: nuevos };
                            });
                            setEditandoCotizIdx(null);
                          }} style={{ background: 'linear-gradient(135deg,#1e3a5f,#2d4a6e)', color: '#58a6ff', border: '1px solid #58a6ff55', borderRadius: 8, padding: '9px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Guardar Cambios</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ÁREA IMPRIMIBLE — fondo claro como reporte diario */}
                  <div id="reporte-cotizaciones" style={{ background: '#f0f4f8', borderRadius: 12, overflow: 'hidden', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

                    {/* HEADER — igual al reporte diario */}
                    <div style={{ background: 'linear-gradient(135deg,#1a2332 0%,#2d4a6e 100%)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#7fb3d3', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>InfiniteX · Agente de Tráfico · Sicoben Ediciones</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>COMPARACIÓN DE COTIZACIONES</div>
                        <div style={{ fontSize: 12, color: '#58a6ff', fontWeight: 600, marginTop: 6 }}>
                          {rows.length} cotización(es) analizadas &nbsp;·&nbsp; {new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </div>
                        {embarqueComparador && (
                          <div style={{ marginTop: 10, background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 8, padding: '8px 14px', display: 'inline-block' }}>
                            <div style={{ fontSize: 9, color: '#7fb3d3', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>Carga en cotización</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{embarqueComparador.descripcion}</div>
                            <div style={{ fontSize: 11, color: '#58a6ff', marginTop: 2 }}>
                              {embarqueComparador.bl}
                              {embarqueComparador.proveedor && <> &nbsp;·&nbsp; {embarqueComparador.proveedor}</>}
                              {embarqueComparador.origen && <> &nbsp;·&nbsp; {embarqueComparador.origen} → {embarqueComparador.destino || 'PTY'}</>}
                              {embarqueComparador.contenedor && <> &nbsp;·&nbsp; {embarqueComparador.contenedor}</>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <svg width="48" height="48" viewBox="0 0 80 80" fill="none">
                          <defs>
                            <radialGradient id="rcg" cx="38%" cy="35%" r="65%">
                              <stop offset="0%" stopColor="#1a3a5c"/>
                              <stop offset="100%" stopColor="#0a1628"/>
                            </radialGradient>
                            <clipPath id="rcc"><circle cx="40" cy="40" r="34"/></clipPath>
                            <filter id="rcglow"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                          </defs>
                          <circle cx="40" cy="40" r="34" fill="url(#rcg)"/>
                          <g clipPath="url(#rcc)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.7" fill="none">
                            <ellipse cx="40" cy="40" rx="34" ry="10"/><ellipse cx="40" cy="40" rx="34" ry="22"/>
                            <ellipse cx="40" cy="40" rx="34" ry="32"/><line x1="40" y1="6" x2="40" y2="74"/>
                            <ellipse cx="40" cy="40" rx="17" ry="34"/><ellipse cx="40" cy="40" rx="28" ry="34"/>
                          </g>
                          <g clipPath="url(#rcc)" stroke="#6eaadf" strokeWidth="0.9" fill="none" strokeOpacity="0.4">
                            <path d="M22 32 Q32 14 50 22"/><path d="M50 22 Q62 28 58 44"/>
                            <path d="M22 32 Q20 50 30 58"/><path d="M14 42 Q18 36 22 32"/>
                          </g>
                          <path d="M22 32 Q32 14 50 22" stroke="#b8d8f8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          <path d="M50 22 Q62 28 58 44" stroke="#b8d8f8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          <path d="M14 42 Q18 36 22 32" stroke="#b8d8f8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                          <g filter="url(#rcglow)">
                            <circle cx="22" cy="32" r="2.8" fill="#7bbcf0"/><circle cx="50" cy="22" r="2.5" fill="#7bbcf0"/>
                            <circle cx="58" cy="44" r="2.5" fill="#7bbcf0"/><circle cx="14" cy="42" r="2" fill="#7bbcf0"/>
                          </g>
                          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(110,170,223,0.35)" strokeWidth="1"/>
                          <ellipse cx="32" cy="28" rx="9" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-20,32,28)"/>
                        </svg>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>
                            <span style={{ color: '#58a6ff' }}>Infinite</span><span style={{ color: '#fff' }}>X</span>
                          </div>
                          <div style={{ fontSize: 9, color: '#7fb3d3', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>SISTEMA LOGÍSTICO</div>
                          <div style={{ fontSize: 9, color: '#4a6280', marginTop: 2, letterSpacing: 1 }}>KADI INTERNACIONAL S.A.</div>
                        </div>
                      </div>
                    </div>

                    {/* TABLA — filas = cotizaciones, columnas = campos */}
                    <div style={{ padding: '20px 20px 0', background: '#fff' }}>
                      <div style={{ fontSize: 10, color: '#3498db', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>DETALLE COMPARATIVO DE COTIZACIONES</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, background: '#1a2332', width: 70, textAlign: 'center' }}>ITEM</th>
                              {COLS.map(c => <th key={c.key} style={thStyle}>{c.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r: any, i: number) => {
                              const d = r.datos || {};
                              const esRec = i === rec;
                              const isCalcETA = typeof d.eta === 'string' && d.eta.includes('*');
                              const rowBg = esRec ? '#e8f5e9' : i % 2 === 0 ? '#fff' : '#f7f9fc';
                              const textColor = esRec ? '#1a5c2a' : '#1a2332';
                              const cellStyle: React.CSSProperties = {
                                padding: '10px 14px', fontSize: 12, color: textColor,
                                textAlign: 'center', borderBottom: '1px solid #e8edf2',
                                borderRight: '1px solid #e8edf2', fontWeight: esRec ? 700 : 400,
                                background: rowBg,
                              };
                              const vals: Record<string,string> = {
                                agente_operador: d.agente_operador || '-',
                                monto_display:   d.costo_total || '-',
                                tiempo_transito: d.tiempo_transito || '-',
                                naviera:         d.naviera || '-',
                                tipo_contenedor: d.tipo_contenedor || '-',
                                etd:             d.etd || '-',
                                eta:             d.eta ? d.eta.replace(' *','') : '-',
                                dias_libres:     d.dias_libres || '-',
                                incoterm:        d.incoterm || '-',
                                validez:         d.validez || '-',
                              };
                              return (
                                <tr key={i}>
                                  <td style={{ ...cellStyle, fontWeight: 800, fontSize: 14, color: esRec ? '#1a5c2a' : '#3498db', width: 70 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                      <span>{i + 1}</span>
                                      {esRec && <span style={{ fontSize: 9, color: '#27ae60', fontWeight: 700 }}>★ REC.</span>}
                                      <button
                                        onClick={() => handleAbrirEdicion(i)}
                                        style={{ background: '#1e3a5f', color: '#58a6ff', border: '1px solid #58a6ff55', borderRadius: 5, padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', marginTop: 2 }}
                                      >
                                        ✏ editar
                                      </button>
                                    </div>
                                  </td>
                                  {COLS.map(col => (
                                    <td key={col.key} style={{
                                      ...cellStyle,
                                      color: col.key === 'monto_display' ? (esRec ? '#1a5c2a' : '#2563eb') : textColor,
                                      fontWeight: col.key === 'monto_display' ? 700 : esRec ? 700 : 400,
                                    }}>
                                      {vals[col.key]}
                                      {col.key === 'eta' && isCalcETA && <span style={{ display: 'block', fontSize: 9, color: '#718096' }}>calculado</span>}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* RECOMENDACIÓN */}
                    {resultadoComparativa.recomendacion && (
                      <div style={{ background: '#fff', padding: '16px 20px', borderTop: '2px solid #e8edf2' }}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#f3e8fd', borderRadius: 8, padding: '14px 18px', border: '1px solid #d6b0f5' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#8e44ad', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', flexShrink: 0, marginTop: 2 }}>✦</div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#6b21a8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Recomendación del Agente IA — Mejor Opción en Costo y Tiempo de Tránsito</div>
                            <p style={{ margin: 0, fontSize: 13, color: '#4a1772', lineHeight: 1.8 }}>{resultadoComparativa.recomendacion}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FOOTER */}
                    <div style={{ background: '#1a2332', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: '#7fb3d3' }}>KADI INTERNACIONAL S.A. · SICOBEN EDICIONES · Generado automáticamente por InfiniteX</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <svg width="22" height="22" viewBox="0 0 80 80" fill="none">
                          <defs>
                            <radialGradient id="fcg" cx="38%" cy="35%" r="65%">
                              <stop offset="0%" stopColor="#1a3a5c"/><stop offset="100%" stopColor="#0a1628"/>
                            </radialGradient>
                            <clipPath id="fcc"><circle cx="40" cy="40" r="34"/></clipPath>
                          </defs>
                          <circle cx="40" cy="40" r="34" fill="url(#fcg)"/>
                          <g clipPath="url(#fcc)" stroke="rgba(110,170,223,0.22)" strokeWidth="0.8" fill="none">
                            <ellipse cx="40" cy="40" rx="34" ry="12"/><ellipse cx="40" cy="40" rx="34" ry="24"/>
                            <line x1="40" y1="6" x2="40" y2="74"/><ellipse cx="40" cy="40" rx="20" ry="34"/>
                          </g>
                          <path d="M22 32 Q32 14 50 22" stroke="#b8d8f8" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                          <path d="M50 22 Q62 28 58 44" stroke="#b8d8f8" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                          <circle cx="22" cy="32" r="3" fill="#7bbcf0"/><circle cx="50" cy="22" r="2.5" fill="#7bbcf0"/>
                          <circle cx="58" cy="44" r="2.5" fill="#7bbcf0"/>
                          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(110,170,223,0.3)" strokeWidth="1"/>
                        </svg>
                        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
                          <span style={{ color: '#58a6ff' }}>Infinite</span><span style={{ color: '#7fb3d3' }}>X</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* HISTORIAL DE CARGAS FINALIZADAS */}
      <div style={{ maxWidth: 1400, margin: '40px auto 0', padding: '0 32px' }}>
        <button
          onClick={() => setVerHistorial(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            background: '#161b22', border: '1px solid rgba(0,212,170,0.25)',
            borderRadius: 10, padding: '14px 20px', cursor: 'pointer',
            color: '#00d4aa', fontSize: 14, fontWeight: 600, textAlign: 'left',
            marginBottom: verHistorial ? 0 : 8,
            borderBottomLeftRadius: verHistorial ? 0 : 10,
            borderBottomRightRadius: verHistorial ? 0 : 10,
          }}
        >
          <span style={{ fontSize: 18 }}>📦</span>
          <span>Historial de Cargas Finalizadas — Disponibles en Anker</span>
          <span style={{
            marginLeft: 10, background: 'rgba(0,212,170,0.15)', color: '#00d4aa',
            fontSize: 12, padding: '2px 10px', borderRadius: 20,
            border: '1px solid rgba(0,212,170,0.3)',
          }}>{historial.length}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8b949e' }}>{verHistorial ? '▲ Ocultar' : '▼ Ver historial'}</span>
        </button>

        {verHistorial && (
          <div style={{
            background: '#161b22', border: '1px solid rgba(0,212,170,0.25)',
            borderTop: 'none', borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
            overflow: 'hidden', marginBottom: 8,
          }}>
            {historial.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8b949e', fontSize: 13 }}>
                Aún no hay cargas finalizadas. Cuando una carga sea marcada como "Disponible en Anker" aparecerá aquí.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,212,170,0.05)', borderBottom: '1px solid rgba(0,212,170,0.15)' }}>
                      {['BL / Booking', 'Proveedor', 'Descripción', 'Contenedor', 'Naviera', 'ETA', 'Disponible desde', 'Peso / CBM'].map(h => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left', fontSize: 10,
                          color: '#00d4aa99', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((e: any, i: number) => (
                      <tr key={e.id} style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#e6edf3', whiteSpace: 'nowrap' }}>{e.bl}</td>
                        <td style={{ padding: '12px 14px', color: '#a78bfa', whiteSpace: 'nowrap' }}>{e.proveedor}</td>
                        <td style={{ padding: '12px 14px', color: '#8b949e', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.descripcion || '-'}</td>
                        <td style={{ padding: '12px 14px', color: '#58a6ff', whiteSpace: 'nowrap' }}>{e.contenedor}</td>
                        <td style={{ padding: '12px 14px', color: '#8b949e', whiteSpace: 'nowrap' }}>{e.naviera || '-'}</td>
                        <td style={{ padding: '12px 14px', color: '#e6edf3', whiteSpace: 'nowrap' }}>{e.eta || '-'}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          {e.fecha_disponible ? (
                            <span style={{ color: '#00d4aa', fontWeight: 600 }}>
                              {new Date(e.fecha_disponible).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#8b949e', whiteSpace: 'nowrap' }}>
                          {e.peso_kg ? `${Number(e.peso_kg).toLocaleString()} kg` : '-'}
                          {e.cbm ? ` / ${e.cbm} CBM` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 40, padding: '16px 40px',
        display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#2d3f55' }}>
        <span style={{ fontWeight: 500, color: '#3d4f66' }}>InfiniteX · Sicoben Ediciones Panama</span>
        <span>KADI INTERNATIONAL S.A. © 2026</span>
      </div>

      {/* MODAL PREVIEW WHATSAPP */}
      {previewWA && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }} onClick={() => setPreviewWA(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#111b21', borderRadius: 16, width: '100%', maxWidth: 420,
            overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          }}>
            {/* Header WhatsApp */}
            <div style={{ background: '#202c33', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#0d1117,#1c2526)', border: '2px solid #58a6ff33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#58a6ff', letterSpacing: 1 }}>IX</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e9edef' }}>InfiniteX · Agente Tráfico</div>
                <div style={{ fontSize: 12, color: '#8696a0' }}>Sicoben Ediciones · Kadi Internacional</div>
              </div>
              <button onClick={() => setPreviewWA(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#8696a0', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Fondo chat */}
            <div style={{ background: '#0b141a', padding: '16px 12px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Burbuja mensaje */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <div style={{
                  background: '#005c4b', borderRadius: '12px 2px 12px 12px',
                  padding: '10px 14px', maxWidth: '88%',
                  fontSize: 13, color: '#e9edef', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>
                  {generarTextoWA(embarques)}
                  <div style={{ textAlign: 'right', marginTop: 6, fontSize: 11, color: 'rgba(233,237,239,0.6)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                    {new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                    <span style={{ color: '#53bdeb' }}>✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer info */}
            <div style={{ background: '#202c33', padding: '10px 16px', fontSize: 11, color: '#8696a0', textAlign: 'center' }}>
              Este mensaje se enviará a Daniel Benarroch, Asist. Dirección y Asist. Ventas · 8:00 AM diario
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPORTE DIARIO */}
      {verReporte && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.90)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }} onClick={() => setVerReporte(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#0d1117', borderRadius: 16, width: '100%', maxWidth: 1200,
            maxHeight: '92vh', display: 'flex', flexDirection: 'column',
            border: '1px solid #30363d', overflow: 'hidden',
          }}>
            {/* Header modal */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 20px', borderBottom: '1px solid #21262d',
              background: '#161b22',
            }}>
              <span style={{ fontSize: 18 }}>📊</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>Reporte Diario</div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>Así es como lo recibe el equipo en su correo</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={handleDescargarReporteImagen}
                  disabled={descargandoReporteImg}
                  style={{
                    background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
                    border: '1px solid #a78bfa44', borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 600, cursor: descargandoReporteImg ? 'not-allowed' : 'pointer',
                    opacity: descargandoReporteImg ? 0.7 : 1, transition: 'all 0.2s',
                  }}
                >
                  {descargandoReporteImg ? '⏳ Generando…' : '🖼 Descargar Imagen'}
                </button>
                <button
                  onClick={handleEnviarReporte}
                  disabled={enviandoReporte}
                  style={{
                    background: reporteEnviado ? 'rgba(63,185,80,0.15)' : 'rgba(88,166,255,0.15)',
                    color: reporteEnviado ? '#3fb950' : '#58a6ff',
                    border: `1px solid ${reporteEnviado ? '#3fb95044' : '#58a6ff44'}`,
                    borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 600, cursor: enviandoReporte ? 'not-allowed' : 'pointer',
                    opacity: enviandoReporte ? 0.7 : 1, transition: 'all 0.2s',
                  }}
                >
                  {enviandoReporte ? '⏳ Enviando…' : reporteEnviado ? '✅ Enviado al equipo' : '✉ Enviar al Equipo'}
                </button>
                <button
                  onClick={() => setVerReporte(false)}
                  style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                >✕</button>
              </div>
            </div>
            {/* Iframe con el HTML del reporte */}
            <div style={{ flex: 1, overflow: 'hidden', background: '#f0f4f8' }}>
              <iframe
                ref={reporteIframeRef}
                srcDoc={generarHTMLReporte()}
                style={{ width: '100%', height: '100%', border: 'none', minHeight: 600 }}
                title="Reporte Diario InfiniteX"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
