'use client';
import { useState } from 'react';

const PROVEEDORES = [
  { id: 'prov-1', nombre: 'ANKER INNOVATIONS', pais: 'China', contacto: 'supplier@anker.com' },
  { id: 'prov-2', nombre: 'NINGBO LOGISTICS CO', pais: 'China', contacto: 'info@ningbo.cn' },
  { id: 'prov-3', nombre: 'SHENZHEN TRADE LTD', pais: 'China', contacto: 'trade@sz.com' },
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

const ESTADO_COLORS: Record<string, string> = {
  'En Transito': '#58a6ff',
  'En Puerto Origen': '#d29922',
  'En Aduana': '#f85149',
  'Liberado': '#3fb950',
  'Entregado': '#8b949e',
};

export default function AgenteTrafico() {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState('');
  const [embarqueSeleccionado, setEmbarqueSeleccionado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState('');

  const embarquesFiltrados = proveedorSeleccionado
    ? EMBARQUES_DEMO.filter(e => e.proveedor === PROVEEDORES.find(p => p.id === proveedorSeleccionado)?.nombre)
    : EMBARQUES_DEMO;

  const embarqueDetalle = embarqueSeleccionado ? EMBARQUES_DEMO.find(e => e.id === embarqueSeleccionado) : null;

  const notificarEquipo = async () => {
    setEnviando(true);
    setResultado('');
    try {
      const url = process.env.NEXT_PUBLIC_EDGE_FUNCTION_URL || '';
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + anon },
        body: JSON.stringify({ action: 'ping' }),
      });
      const data = await res.json();
      setResultado('Notificacion enviada correctamente. Sistema operativo.');
    } catch {
      setResultado('Error al conectar con el agente.');
    }
    setEnviando(false);
  };

  const s = {
    page: { minHeight: '100vh', backgroundColor: '#0d1117', color: '#e6edf3', fontFamily: "'Segoe UI', system-ui, sans-serif" },
    header: { backgroundColor: '#161b22', borderBottom: '1px solid #21262d', padding: '18px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logo: { letterSpacing: '4px', fontSize: '20px', fontWeight: '700' },
    nav: { display: 'flex', gap: '12px', alignItems: 'center' },
    backBtn: { color: '#8b949e', fontSize: '13px', textDecoration: 'none', padding: '6px 14px', border: '1px solid #21262d', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'transparent' },
    section: { padding: '32px 40px' },
    label: { color: '#8b949e', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' as const, display: 'block', marginBottom: '8px' },
    select: { width: '100%', backgroundColor: '#161b22', border: '1px solid #21262d', color: '#e6edf3', padding: '10px 14px', borderRadius: '6px', fontSize: '14px', marginBottom: '0' },
    card: { backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '20px', marginBottom: '12px', cursor: 'pointer' },
    badge: (estado: string) => ({ backgroundColor: 'rgba(88,166,255,0.1)', color: ESTADO_COLORS[estado] || '#8b949e', fontSize: '11px', padding: '3px 10px', borderRadius: '12px' }),
    detailCard: { backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '28px' },
    row: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #21262d', padding: '12px 0', gap: '16px' },
    fieldLabel: { color: '#8b949e', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' as const, minWidth: '160px' },
    fieldValue: { color: '#e6edf3', fontSize: '14px', textAlign: 'right' as const },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    btn: { backgroundColor: '#238636', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  };

  return (
    <main style={s.page}>
      <header style={s.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <div style={s.logo}>
            <span style={{color: '#58a6ff'}}>INFINITE</span>
            <span style={{color: '#ffffff'}}> X</span>
          </div>
          <div style={{width: '1px', height: '24px', backgroundColor: '#21262d'}}></div>
          <span style={{color: '#58a6ff', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase'}}>Agente de Trafico</span>
        </div>
        <div style={s.nav}>
          <a href="/" style={s.backBtn}>← Dashboard</a>
          <span style={{color: '#3fb950', fontSize: '12px'}}>● Operativo</span>
        </div>
      </header>

      <section style={s.section}>
        <p style={{...s.label, marginBottom: '4px'}}>Panel de Supervision</p>
        <h1 style={{fontSize: '24px', fontWeight: '600', marginBottom: '4px'}}>Agente de Trafico</h1>
        <p style={{color: '#8b949e', fontSize: '14px', marginBottom: '32px'}}>Monitoreo de embarques en transito — Sicoben Ediciones</p>

        <div style={s.grid2}>
          {/* COLUMNA IZQUIERDA */}
          <div>
            {/* FILTRO PROVEEDOR */}
            <div style={{marginBottom: '24px'}}>
              <label style={s.label}>Filtrar por Proveedor</label>
              <select
                style={s.select}
                value={proveedorSeleccionado}
                onChange={e => { setProveedorSeleccionado(e.target.value); setEmbarqueSeleccionado(null); }}
              >
                <option value="">Todos los proveedores</option>
                {PROVEEDORES.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} — {p.pais}</option>
                ))}
              </select>
            </div>

            {/* LISTA DE EMBARQUES */}
            <div>
              <label style={s.label}>Embarques Activos ({embarquesFiltrados.length})</label>
              {embarquesFiltrados.map(emb => (
                <div
                  key={emb.id}
                  style={{...s.card, borderLeft: embarqueSeleccionado === emb.id ? '3px solid #58a6ff' : '3px solid #21262d'}}
                  onClick={() => setEmbarqueSeleccionado(emb.id)}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <span style={{color: '#e6edf3', fontWeight: '600', fontSize: '14px'}}>BL: {emb.bl}</span>
                    <span style={s.badge(emb.estado)}>{emb.estado}</span>
                  </div>
                  <div style={{color: '#8b949e', fontSize: '12px', marginBottom: '4px'}}>{emb.proveedor}</div>
                  <div style={{display: 'flex', gap: '16px', color: '#8b949e', fontSize: '12px'}}>
                    <span>ETA: <span style={{color: '#e6edf3'}}>{emb.eta}</span></span>
                    <span>Contenedor: <span style={{color: '#e6edf3'}}>{emb.contenedor}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* NOTIFICAR */}
            <div style={{marginTop: '24px', backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '20px'}}>
              <label style={s.label}>Notificar Equipo de Produccion</label>
              <p style={{color: '#8b949e', fontSize: '13px', marginBottom: '16px'}}>Envia reporte de estado al equipo: Daniel Benarroch, Asistente Direccion, Asistente Ventas</p>
              <button style={s.btn} onClick={notificarEquipo} disabled={enviando}>
                {enviando ? 'Enviando...' : '📧 Enviar Reporte al Equipo'}
              </button>
              {resultado && <p style={{color: '#3fb950', fontSize: '13px', marginTop: '12px'}}>✓ {resultado}</p>}
            </div>
          </div>

          {/* COLUMNA DERECHA — DETALLE */}
          <div>
            {embarqueDetalle ? (
              <div style={s.detailCard}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px'}}>
                  <div>
                    <p style={{...s.label, marginBottom: '4px'}}>Detalle del Embarque</p>
                    <h2 style={{fontSize: '18px', fontWeight: '600', color: '#58a6ff'}}>{embarqueDetalle.bl}</h2>
                  </div>
                  <span style={s.badge(embarqueDetalle.estado)}>{embarqueDetalle.estado}</span>
                </div>

                {[
                  ['Proveedor', embarqueDetalle.proveedor],
                  ['Naviera', embarqueDetalle.naviera],
                  ['Incoterm', embarqueDetalle.incoterm],
                  ['Tipo Contenedor', embarqueDetalle.contenedor],
                  ['Puerto Origen', embarqueDetalle.origen],
                  ['Puerto Destino', embarqueDetalle.destino_puerto],
                  ['ETD (Salida)', embarqueDetalle.etd],
                  ['ETA (Llegada)', embarqueDetalle.eta],
                  ['Peso Total', embarqueDetalle.peso_kg.toLocaleString() + ' kg'],
                  ['Volumen CBM', embarqueDetalle.cbm + ' m³'],
                  ['Pallets', embarqueDetalle.pallets.toString()],
                  ['Descripcion', embarqueDetalle.descripcion],
                ].map(([k, v]) => (
                  <div key={k} style={s.row}>
                    <span style={s.fieldLabel}>{k}</span>
                    <span style={s.fieldValue}>{v}</span>
                  </div>
                ))}

                <div style={{marginTop: '20px'}}>
                  <label style={s.label}>Documentos</label>
                  <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {Object.entries(embarqueDetalle.documentos).map(([doc, ok]) => (
                      <span key={doc} style={{fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)', color: ok ? '#3fb950' : '#f85149'}}>
                        {ok ? '✓' : '✗'} {doc.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                {embarqueDetalle.notas && (
                  <div style={{marginTop: '20px', padding: '14px', backgroundColor: 'rgba(210,153,34,0.08)', borderRadius: '6px', border: '1px solid rgba(210,153,34,0.2)'}}>
                    <p style={{color: '#d29922', fontSize: '12px', letterSpacing: '1px', marginBottom: '4px'}}>NOTA</p>
                    <p style={{color: '#e6edf3', fontSize: '13px'}}>{embarqueDetalle.notas}</p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{...s.detailCard, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px'}}>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '32px', marginBottom: '12px'}}>📦</p>
                  <p style={{color: '#8b949e', fontSize: '14px'}}>Selecciona un embarque para ver el detalle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
