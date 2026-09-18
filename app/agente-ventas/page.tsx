'use client';
import { useEffect, useMemo, useState } from 'react';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

type Pedido = {
  id: string;
  numero_pedido: string | null;
  nombre_item: string;
  cliente: string | null;
  pais_destino: string | null;
  responsable_comercial: string | null;
  valor_pedido: number | null;
  estado_monday: string | null;
  estatus_agente: string | null;
  fecha_solicitud: string | null;
  fecha_listo: string | null;
  fecha_despacho: string | null;
  observaciones: string | null;
  updated_at: string;
};

// Colores por estatus operativo — mismo criterio visual que ESTADO_COLORS en Agente de Tráfico.
const ESTATUS_COLORS: Record<string, string> = {
  'En verificación': '#a78bfa',
  'En preparación': '#f97316',
  'Preparado': '#22d3ee',
  'En proceso de despacho': '#0ea5e9',
  'Despachado': '#58a6ff',
  'Entregado': '#3aaa6e',
  'En espera de importaciones': '#d29922',
  'Sin definir salidas': '#8b949e',
  'Revisión manual requerida': '#f85149',
  'Fuera de alcance (prospección)': '#4a6280',
};

function noReg(v: string | null | undefined) {
  return v && v.trim() ? v : null;
}

function GlobeSmall() {
  return (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <defs>
        <radialGradient id="hgav" cx="38%" cy="35%" r="65%"><stop offset="0%" stopColor="#1a3a5c" /><stop offset="100%" stopColor="#0a1628" /></radialGradient>
        <clipPath id="hcav"><circle cx="40" cy="40" r="34" /></clipPath>
      </defs>
      <circle cx="40" cy="40" r="34" fill="url(#hgav)" />
      <g clipPath="url(#hcav)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.7" fill="none">
        <ellipse cx="40" cy="40" rx="34" ry="10" /><ellipse cx="40" cy="40" rx="34" ry="22" /><ellipse cx="40" cy="40" rx="34" ry="32" />
        <line x1="40" y1="6" x2="40" y2="74" /><ellipse cx="40" cy="40" rx="17" ry="34" /><ellipse cx="40" cy="40" rx="28" ry="34" />
      </g>
      <circle cx="40" cy="40" r="34" stroke="#5ba3e0" strokeOpacity="0.35" strokeWidth="1" fill="none" />
    </svg>
  );
}

export default function AgenteVentas() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [notif, setNotif] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null);
  const [ultimaSync, setUltimaSync] = useState<Date | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [fCliente, setFCliente] = useState('todos');
  const [fResponsable, setFResponsable] = useState('todos');
  const [fEstatus, setFEstatus] = useState('todos');
  const [detalle, setDetalle] = useState<Pedido | null>(null);

  async function cargarPedidos() {
    setCargando(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_venta?activo=eq.true&order=updated_at.desc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setPedidos(data);
    } catch (_) {}
    setCargando(false);
  }

  useEffect(() => { cargarPedidos(); }, []);

  async function handleSincronizar() {
    setSincronizando(true);
    setNotif(null);
    try {
      const res = await fetch('/api/monday-sync-ventas', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setNotif({ tipo: 'ok', msg: `Monday.com sincronizado: ${data.creados} nuevo(s), ${data.actualizados} actualizado(s) de ${data.total} pedido(s).${data.errores?.length ? ` ${data.errores.length} con error.` : ''}` });
        setUltimaSync(new Date());
        await cargarPedidos();
      } else {
        setNotif({ tipo: 'error', msg: 'Error al sincronizar con Monday.com: ' + (data.error || 'desconocido') });
      }
    } catch (e) {
      setNotif({ tipo: 'error', msg: 'Error al sincronizar con Monday.com: ' + String(e) });
    }
    setSincronizando(false);
  }

  const clientes = useMemo(() => [...new Set(pedidos.map(p => p.cliente).filter(Boolean))].sort() as string[], [pedidos]);
  const responsables = useMemo(() => [...new Set(pedidos.map(p => p.responsable_comercial).filter(Boolean))].sort() as string[], [pedidos]);
  const estatusList = useMemo(() => [...new Set(pedidos.map(p => p.estatus_agente).filter(Boolean))].sort() as string[], [pedidos]);

  const filtrados = useMemo(() => pedidos.filter(p => {
    if (fCliente !== 'todos' && p.cliente !== fCliente) return false;
    if (fResponsable !== 'todos' && p.responsable_comercial !== fResponsable) return false;
    if (fEstatus !== 'todos' && p.estatus_agente !== fEstatus) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const hay = [p.numero_pedido, p.nombre_item, p.cliente].some(v => (v || '').toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  }), [pedidos, fCliente, fResponsable, fEstatus, busqueda]);

  const kpis = useMemo(() => ({
    verificacionPrep: pedidos.filter(p => p.estatus_agente === 'En verificación' || p.estatus_agente === 'En preparación').length,
    preparados: pedidos.filter(p => p.estatus_agente === 'Preparado').length,
    despacho: pedidos.filter(p => p.estatus_agente === 'En proceso de despacho' || p.estatus_agente === 'Despachado').length,
    entregados: pedidos.filter(p => p.estatus_agente === 'Entregado').length,
    sinDefinir: pedidos.filter(p => p.estatus_agente === 'Sin definir salidas').length,
    revision: pedidos.filter(p => p.estatus_agente === 'Revisión manual requerida').length,
  }), [pedidos]);

  const inputStyle: React.CSSProperties = {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#e2eaf6',
    padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1421', color: '#e2eaf6', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64, gap: 16, backgroundColor: '#0d1421', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobeSmall />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Infinite<span style={{ color: '#5ba3e0' }}>X</span></div>
            <div style={{ fontSize: 10, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase' }}>Sistema Logístico</div>
          </div>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#5ba3e0', letterSpacing: 1, textTransform: 'uppercase' }}>Agente de Ventas</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/" style={{ color: '#4a6280', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ba3e0', boxShadow: '0 0 7px #5ba3e0', display: 'inline-block' }} />
            <span style={{ color: '#5ba3e0', fontSize: 12, fontWeight: 500 }}>En Desarrollo</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 40px 80px' }}>
        <div style={{ fontSize: 11, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Panel de Supervisión</div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 6px' }}>Agente de Ventas</h1>
        <p style={{ color: '#7a8fa8', fontSize: 14, margin: '0 0 20px' }}>Seguimiento de pedidos de exportación — Sicoben Ediciones</p>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, color: '#7a8fa8', marginBottom: 20 }}>
          ⚠️ Versión de solo lectura (Etapa 2–4 del plan). Edición, notificaciones y permisos quedan pendientes de las decisiones de la propuesta — ver el documento de diseño.
        </div>

        {notif && (
          <div style={{
            background: notif.tipo === 'ok' ? 'rgba(58,170,110,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${notif.tipo === 'ok' ? '#3aaa6e44' : '#f8514944'}`,
            color: notif.tipo === 'ok' ? '#3aaa6e' : '#f85149',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13,
          }}>
            {notif.tipo === 'ok' ? '✓ ' : '✕ '}{notif.msg}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { l: 'En verificación / preparación', v: kpis.verificacionPrep, c: '#a78bfa' },
            { l: 'Preparados', v: kpis.preparados, c: '#22d3ee' },
            { l: 'En despacho', v: kpis.despacho, c: '#0ea5e9' },
            { l: 'Entregados', v: kpis.entregados, c: '#3aaa6e' },
            { l: 'Sin salida definida', v: kpis.sinDefinir, c: '#8b949e' },
            { l: 'Revisión manual', v: kpis.revision, c: '#f85149' },
          ].map(k => (
            <div key={k.l} style={{ background: '#111827', border: '1px solid #30363d', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
              <div style={{ fontSize: 11, color: '#7a8fa8', marginTop: 4 }}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <button onClick={handleSincronizar} disabled={sincronizando} style={{
            background: 'rgba(0,120,212,0.12)', color: '#0086c9', border: '1px solid #0086c944', borderRadius: 8,
            padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: sincronizando ? 'not-allowed' : 'pointer', opacity: sincronizando ? 0.6 : 1,
          }}>
            {sincronizando ? '⏳ Sincronizando…' : '🔄 Sincronizar desde Monday'}
          </button>
          {ultimaSync && <span style={{ fontSize: 11.5, color: '#4a6280' }}>Última sincronización: {ultimaSync.toLocaleTimeString('es-PA')}</span>}
          <input placeholder="Buscar por pedido, cliente o ítem…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...inputStyle, flex: '1 1 240px', minWidth: 200 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <select value={fCliente} onChange={e => setFCliente(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los clientes</option>
            {clientes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fResponsable} onChange={e => setFResponsable(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los responsables</option>
            {responsables.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={fEstatus} onChange={e => setFEstatus(e.target.value)} style={inputStyle}>
            <option value="todos">Todos los estatus</option>
            {estatusList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Tabla */}
        <div style={{ background: '#111827', border: '1px solid #30363d', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
            <thead>
              <tr style={{ background: '#161b22' }}>
                {['Pedido', 'Cliente', 'País destino', 'Responsable', 'F. solicitud', 'Estatus (agente)', 'Estado (Monday)', 'Últ. actualización', 'F. est. despacho', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#7a8fa8', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #30363d', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#4a6280' }}>Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#4a6280' }}>Sin pedidos — usa "Sincronizar desde Monday" para traer los datos.</td></tr>
              ) : filtrados.map(p => {
                const color = ESTATUS_COLORS[p.estatus_agente || ''] || '#8b949e';
                return (
                  <tr key={p.id} onClick={() => setDetalle(p)} style={{ borderBottom: '1px solid #21262d', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px' }}>{noReg(p.numero_pedido) || <em style={{ color: '#4a6280' }}>No registrado</em>}</td>
                    <td style={{ padding: '10px 14px' }}>{noReg(p.cliente) || p.nombre_item}</td>
                    <td style={{ padding: '10px 14px', color: '#4a6280' }}>{noReg(p.pais_destino) || 'No registrado'}</td>
                    <td style={{ padding: '10px 14px' }}>{noReg(p.responsable_comercial) || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#7a8fa8' }}>{noReg(p.fecha_solicitud) || 'No registrado'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: `${color}22`, color, border: `1px solid ${color}55`, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{p.estatus_agente}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#7a8fa8', fontSize: 12 }}>{p.estado_monday || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#4a6280', fontSize: 12 }}>{new Date(p.updated_at).toLocaleDateString('es-PA')}</td>
                    <td style={{ padding: '10px 14px', color: '#7a8fa8' }}>{noReg(p.fecha_listo) || 'No registrado'}</td>
                    <td style={{ padding: '10px 14px', color: '#5ba3e0', fontSize: 12 }}>Ver →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Vista detallada */}
      {detalle && (
        <div onClick={() => setDetalle(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid #30363d', borderRadius: 14, padding: 28, maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: '#4a6280', textTransform: 'uppercase', letterSpacing: 1 }}>Pedido</div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{noReg(detalle.numero_pedido) || 'No registrado'}</div>
                <div style={{ color: '#7a8fa8', fontSize: 13, marginTop: 2 }}>{detalle.nombre_item}</div>
              </div>
              <button onClick={() => setDetalle(null)} style={{ background: 'none', border: 'none', color: '#8696a0', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {[
              ['Cliente', noReg(detalle.cliente) || 'No registrado'],
              ['País de destino', noReg(detalle.pais_destino) || 'No registrado'],
              ['Responsable comercial', noReg(detalle.responsable_comercial) || 'No registrado'],
              ['Valor del pedido', detalle.valor_pedido ? `$${detalle.valor_pedido.toLocaleString('es-PA')}` : 'No registrado'],
              ['Estatus del agente', detalle.estatus_agente || '—'],
              ['Estado original (Monday)', detalle.estado_monday || 'No registrado'],
              ['Fecha de solicitud', noReg(detalle.fecha_solicitud) || 'No registrado'],
              ['Fecha estimada / de preparación lista', noReg(detalle.fecha_listo) || 'No registrado'],
              ['Fecha de despacho', noReg(detalle.fecha_despacho) || 'No registrado'],
              ['Fecha de entrega al cliente', 'No registrado'],
              ['Observaciones', noReg(detalle.observaciones) || 'No registrado'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid #21262d', fontSize: 13.5 }}>
                <span style={{ color: '#7a8fa8' }}>{l}</span>
                <span style={{ textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 11.5, color: '#4a6280' }}>
              Edición, bitácora de cambios e historial de notificaciones se activan en las próximas etapas del plan — ver la propuesta.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
