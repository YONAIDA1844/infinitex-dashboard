'use client';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzMxNTEsImV4cCI6MjA2NTM0OTE1MX0.Oa8HbKMOa8LGsiDIj3ROmIJkDpVQFNoiym3HAdTMW9w';

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
  'En Transito':                    '#58a6ff',
  'Asignado operador':              '#22d3ee',
  'Arribo a puerto':                '#818cf8',
  'En Aduana':                      '#f59e0b',
  'En Aduana — CRÍTICO':            '#f85149',
  'Liberado':                       '#3fb950',
  'Entregado':                      '#8b949e',
};

const EQUIPO = [
  { nombre: 'Daniel Benarroch', email: 'daniel.benarroch@sicobenediciones.com' },
  { nombre: 'Asistente Dirección', email: 'asistente.direccion@sicobenediciones.com' },
  { nombre: 'Asistente Ventas', email: 'asistente.ventas@sicobenediciones.com' },
];

const EMBARQUES_DEMO: any[] = [];

const FORM_VACIO = {
  bl: '', proveedor: '', naviera: '', incoterm: 'FOB',
  contenedor: '40HC', origen: '', destino_puerto: 'Manzanillo, Panama',
  etd: '', eta: '', peso_kg: '', cbm: '', pallets: '', descripcion: '',
  estado: 'En Puerto Origen',
  doc_bl: false, doc_packing: false, doc_factura: false, doc_permiso: false,
  notas: '',
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
  const [form, setForm] = useState<any>({ ...FORM_VACIO });
  const [notifEstado, setNotifEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          setProveedores(mapped);
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
      id: 'emb-' + Date.now(),
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
    };

    setEmbarques((prev: any[]) => [nuevo, ...prev]);
    setEmbarqueSeleccionado(nuevo);

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/embarques`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
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
          schema: 'test',
        }),
      });
    } catch (_) {}

    setNotifEstado('ok');
    setNotifMsg(`Embarque ${nuevo.bl} registrado correctamente.`);
    setFormularioAbierto(false);
    setForm({ ...FORM_VACIO });
    setGuardando(false);
  };

  const handleNotificarEquipo = async (embarque: any, autoTrigger = false) => {
    if (!embarque) return;
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
        setNotifMsg(`✅ ${autoTrigger ? 'Notificación automática' : 'Notificación'} de ${embarque.bl} encolada — pendiente de aprobación del Orquestador Central.`);
      } else {
        setNotifEstado('error');
        setNotifMsg(`Error al encolar notificación (${res.status}).`);
      }
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('Error de conexión: ' + e.message);
    }
  };

  const handleCambiarEstado = async (nuevoEstado: string) => {
    if (!embarqueSeleccionado || nuevoEstado === embarqueSeleccionado.estado) return;
    const updated = { ...embarqueSeleccionado, estado: nuevoEstado };
    setEmbarqueSeleccionado(updated);
    setEmbarques((prev: any[]) => prev.map((e: any) => e.id === updated.id ? updated : e));
    await handleNotificarEquipo(updated, true);
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

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', padding: '0 32px', display: 'flex', alignItems: 'center', height: 56, gap: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 3 }}>
          <span style={{ color: '#58a6ff' }}>INFINITE</span>
          <span style={{ color: '#ffffff' }}> X</span>
        </span>
        <span style={{ color: '#8b949e', fontSize: 12, letterSpacing: 2 }}>AGENTE DE TRAFICO</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="/" style={{ color: '#8b949e', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
          <span style={{ color: '#3fb950', fontSize: 13 }}>● Operativo</span>
        </div>
      </div>

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
            onClick={() => { setFormularioAbierto(!formularioAbierto); setNotifMsg(''); }}
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
              📋 Datos del Nuevo Embarque
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
                    style={{
                      marginTop: 10, width: '100%', background: 'rgba(88,166,255,0.07)',
                      color: '#58a6ff', border: '1px solid #58a6ff33',
                      borderRadius: 6, padding: '6px 0', fontSize: 12,
                      cursor: 'pointer', fontWeight: 600, letterSpacing: 0.5,
                    }}
                  >
                    🔔 Notificar a Producción
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
                      style={{
                        background: '#58a6ff', color: '#0d1117',
                        border: 'none', borderRadius: 8,
                        padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 700,
                      }}
                    >
                      🔔 Notificar a Producción
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: '#8b949e', marginTop: 6, marginBottom: 0 }}>
                    Al cambiar el estado o hacer clic en Notificar, la solicitud pasa al Orquestador Central para autorización antes de enviarse.
                  </p>
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

      {/* Footer */}
      <div style={{ borderTop: '1px solid #21262d', marginTop: 40, padding: '16px 32px',
        display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e' }}>
        <span>INFINITE X — Sicoben Ediciones Panama</span>
        <span>KADI INTERNATIONAL S.A. © 2026</span>
      </div>
    </div>
  );
}
