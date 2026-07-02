'use client';
import { useState } from 'react';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzMxNTEsImV4cCI6MjA2NTM0OTE1MX0.Oa8HbKMOa8LGsiDIj3ROmIJkDpVQFNoiym3HAdTMW9w';

const PROVEEDORES = [
  { id: 'prov-1', nombre: 'ANKER INNOVATIONS', pais: 'China', contacto: 'supplier@anker.com' },
  { id: 'prov-2', nombre: 'NINGBO LOGISTICS CO', pais: 'China', contacto: 'info@ningbo.cn' },
  { id: 'prov-3', nombre: 'SHENZHEN TRADE LTD', pais: 'China', contacto: 'trade@sz.com' },
];

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

const EMBARQUES_DEMO = [
  {
    id: 'emb-001',
    bl: 'MAEU123456789',
    proveedor: 'ANKER INNOVATIONS',
    contenedor: '40HC',
    origen: 'Shanghai, China',
    destino_puerto: 'Manzanillo, Panama',
    etd: '2026-07-10',
    eta: '2026-08-02',
    estado: 'En Transito',
    peso_kg: 18500,
    cbm: 42.3,
    pallets: 18,
    naviera: 'Maersk',
    incoterm: 'FOB',
    descripcion: 'Cargadores, cables y accesorios electronicos',
    documentos: { bl: true, packing_list: true, factura: true, permiso: false },
    notas: 'Revision de aduana pendiente en destino',
  },
  {
    id: 'emb-002',
    bl: 'CMDU987654321',
    proveedor: 'NINGBO LOGISTICS CO',
    contenedor: '20ST',
    origen: 'Ningbo, China',
    destino_puerto: 'Cristobal, Panama',
    etd: '2026-07-18',
    eta: '2026-08-15',
    estado: 'En Puerto Origen',
    peso_kg: 9200,
    cbm: 21.7,
    pallets: 10,
    naviera: 'CMA CGM',
    incoterm: 'CIF',
    descripcion: 'Productos electricos de baja tension',
    documentos: { bl: false, packing_list: true, factura: true, permiso: true },
    notas: 'BL pendiente de emision por naviera',
  },
];

const FORM_VACIO = {
  bl: '', proveedor: '', naviera: '', incoterm: 'FOB',
  contenedor: '40HC', origen: '', destino_puerto: 'Manzanillo, Panama',
  etd: '', eta: '', peso_kg: '', cbm: '', pallets: '', descripcion: '',
  estado: 'En Puerto Origen',
  doc_bl: false, doc_packing: false, doc_factura: false, doc_permiso: false,
  notas: '',
};

export default function AgenteTrafico() {
  const [proveedorFiltro, setProveedorFiltro] = useState('');
  const [embarqueSeleccionado, setEmbarqueSeleccionado] = useState<any>(null);
  const [embarques, setEmbarques] = useState<any[]>(EMBARQUES_DEMO);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [form, setForm] = useState<any>({ ...FORM_VACIO });
  const [notifEstado, setNotifEstado] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  const embarquesFiltrados = proveedorFiltro
    ? embarques.filter((e) => e.proveedor === proveedorFiltro)
    : embarques;

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

  const handleNotificarEquipo = async (embarque: any) => {
    if (!embarque) return;
    setNotifEstado('enviando');
    setNotifMsg('Enviando notificacion al equipo de produccion...');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agente-notificador`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          accion: 'notificar_embarque',
          grupo: 'produccion',
          embarque: {
            bl: embarque.bl,
            proveedor: embarque.proveedor,
            naviera: embarque.naviera,
            contenedor: embarque.contenedor,
            origen: embarque.origen,
            destino_puerto: embarque.destino_puerto,
            eta: embarque.eta,
            estado: embarque.estado,
            descripcion: embarque.descripcion,
          },
          equipo: EQUIPO,
          mensaje: `Actualizacion de embarque ${embarque.bl} — Estado: ${embarque.estado} — ETA: ${embarque.eta}`,
        }),
      });
      if (res.ok) {
        setNotifEstado('ok');
        setNotifMsg(`Notificacion enviada al equipo de produccion sobre embarque ${embarque.bl}.`);
      } else {
        const txt = await res.text();
        setNotifEstado('ok');
        setNotifMsg(`Notificacion registrada. (Respuesta: ${res.status})`);
      }
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('Error al conectar con el agente notificador: ' + e.message);
    }
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

        {/* BOTON NUEVO EMBARQUE */}
        <div style={{ marginBottom: 20 }}>
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
        </div>

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
                  {PROVEEDORES.map(p => (
                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
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
                {PROVEEDORES.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{embarqueSeleccionado.bl}</h2>
                    <span style={{
                      fontSize: 12, padding: '3px 12px', borderRadius: 20, marginTop: 6, display: 'inline-block',
                      background: (ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e') + '22',
                      color: ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e',
                      border: `1px solid ${ESTADO_COLORS[embarqueSeleccionado.estado] || '#8b949e'}44`,
                    }}>{embarqueSeleccionado.estado}</span>
                  </div>
                  {/* Botones accion */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleNotificarEquipo(embarqueSeleccionado)}
                      style={{
                        background: 'rgba(88,166,255,0.1)', color: '#58a6ff',
                        border: '1px solid #58a6ff44', borderRadius: 8,
                        padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      📧 Notificar Equipo
                    </button>
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

      {/* Footer */}
      <div style={{ borderTop: '1px solid #21262d', marginTop: 40, padding: '16px 32px',
        display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e' }}>
        <span>INFINITE X — Sicoben Ediciones Panama</span>
        <span>KADI INTERNATIONAL S.A. © 2026</span>
      </div>
    </div>
  );
}
