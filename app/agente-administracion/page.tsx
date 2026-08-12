'use client';
import { useEffect, useState } from 'react';
import {
  calcularVencimiento, calcularDiasRestantes, clasificarEstadoPago, detectarError, debeProcesar,
} from '@/lib/agente-administracion/motor';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDkyMTAsImV4cCI6MjA5NjYyNTIxMH0.wjtwtkUdWvgV188EcuK-4qbAilJc0Q-PuhVD646nue0';

const FORM_FACTURA_VACIO = { numero_factura: '', embarque_bl: '', agente_id: '', monto: '', moneda: 'USD', fecha_factura: '', observaciones: '' };
const FORM_AGENTE_VACIO = { nombre: '', pais: '', contacto: '', email: '', whatsapp: '', dias_credito: '' };

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  'Pendiente':               { bg: 'rgba(139,148,158,0.15)', color: '#8b949e' },
  'Próxima a vencer':        { bg: 'rgba(210,153,34,0.15)',  color: '#d29922' },
  'Vencimiento inminente':   { bg: 'rgba(217,115,13,0.15)',  color: '#d9730d' },
  'Vencida':                 { bg: 'rgba(248,81,73,0.15)',   color: '#f85149' },
  'En proceso de pago':      { bg: 'rgba(88,166,255,0.15)',  color: '#58a6ff' },
  'Pagada':                  { bg: 'rgba(63,185,80,0.15)',   color: '#3fb950' },
};

export default function AgenteAdministracion() {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [embarques, setEmbarques] = useState<any[]>([]);
  const [bitacora, setBitacora] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [formFacturaAbierto, setFormFacturaAbierto] = useState(false);
  const [formFactura, setFormFactura] = useState<any>({ ...FORM_FACTURA_VACIO });
  const [editandoFacturaId, setEditandoFacturaId] = useState<string | null>(null);

  const [formAgenteAbierto, setFormAgenteAbierto] = useState(false);
  const [formAgente, setFormAgente] = useState<any>({ ...FORM_AGENTE_VACIO });
  const [editandoAgenteId, setEditandoAgenteId] = useState<string | null>(null);

  const [ejecutando, setEjecutando] = useState(false);
  const [ultimoResumen, setUltimoResumen] = useState<any>(null);
  const [notifMsg, setNotifMsg] = useState('');
  const [notifEstado, setNotifEstado] = useState('');

  const [previewAbierto, setPreviewAbierto] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewFacturaId, setPreviewFacturaId] = useState<string | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [enviandoManual, setEnviandoManual] = useState(false);

  const modoSimulacion = true; // refleja MODO_SIMULACION del backend (default activo)

  async function cargarTodo() {
    setCargando(true);
    const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    try {
      const [fRes, pRes, eRes, bRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/facturas?select=*&order=created_at.desc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/proveedores?select=*&order=nombre.asc`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/trafico_embarques?select=bl,descripcion,naviera,llegada_real&activo=eq.true`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/notificaciones_facturas?select=*&order=fecha_hora.desc&limit=30`, { headers }),
      ]);
      const [fData, pData, eData, bData] = await Promise.all([fRes.json(), pRes.json(), eRes.json(), bRes.json()]);
      setFacturas(Array.isArray(fData) ? fData : []);
      setProveedores(Array.isArray(pData) ? pData : []);
      setEmbarques(Array.isArray(eData) ? eData : []);
      setBitacora(Array.isArray(bData) ? bData : []);
      if (!Array.isArray(fData)) { setNotifEstado('error'); setNotifMsg('⚠ La tabla "facturas" no existe todavía en Supabase — corre el SQL de configuración inicial.'); }
    } catch (_) {}
    setCargando(false);
  }

  useEffect(() => { cargarTodo(); }, []);

  const agentesLogisticos = proveedores.filter((p: any) => p.tipo === 'agente_carga');
  const proveedorPorId = new Map(proveedores.map((p: any) => [p.id, p]));
  const embarquePorBl = new Map(embarques.map((e: any) => [e.bl, e]));
  // new Date() se difiere a un efecto — llamarlo directo en el render rompe el
  // prerender estático del client component (Next.js 16 Cache Components).
  const [hoyISO, setHoyISO] = useState<string | null>(null);
  useEffect(() => { setHoyISO(new Date().toISOString().slice(0, 10)); }, []);

  // Vista en vivo (solo lectura) reusando el mismo motor que corre en el backend —
  // así la pantalla siempre refleja la regla de negocio real sin duplicar lógica,
  // sin necesidad de disparar el motor con efectos secundarios solo por mirarla.
  const facturasConDatos = !hoyISO ? [] : facturas.map((f: any) => {
    if (!debeProcesar(f)) return { ...f, vencimiento: null, diasRestantes: null, estadoVivo: f.estado_pago, error: null };
    const agente = f.agente_id ? proveedorPorId.get(f.agente_id) : null;
    const embarque = f.embarque_bl ? embarquePorBl.get(f.embarque_bl) : null;
    const error = detectarError(f, agente || null, embarque || null);
    if (error) return { ...f, vencimiento: null, diasRestantes: null, estadoVivo: f.estado_pago, error };
    const vencimiento = calcularVencimiento(embarque.llegada_real, agente.dias_credito);
    const diasRestantes = calcularDiasRestantes(hoyISO, vencimiento);
    return { ...f, vencimiento, diasRestantes, estadoVivo: clasificarEstadoPago(diasRestantes), error: null };
  });

  const resumenVivo = {
    pendientes: facturasConDatos.filter((f: any) => debeProcesar(f) && !f.error).length,
    vencen7d: facturasConDatos.filter((f: any) => f.diasRestantes === 7).length,
    vencen3d: facturasConDatos.filter((f: any) => f.diasRestantes === 3).length,
    vencenManana: facturasConDatos.filter((f: any) => f.diasRestantes === 1).length,
    vencenHoy: facturasConDatos.filter((f: any) => f.diasRestantes === 0).length,
    vencidas: facturasConDatos.filter((f: any) => f.diasRestantes != null && f.diasRestantes < 0).length,
    pagadas: facturasConDatos.filter((f: any) => f.estado_pago === 'Pagada').length,
    conErrores: facturasConDatos.filter((f: any) => f.error).length,
  };

  const [sincronizando, setSincronizando] = useState(false);
  async function handleSincronizarMonday() {
    setSincronizando(true);
    setNotifEstado('enviando');
    setNotifMsg('Sincronizando facturas desde Monday.com…');
    try {
      const res = await fetch('/api/monday-sync-facturas', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setNotifEstado('ok');
        setNotifMsg(`✅ Monday: ${data.creadas} nueva(s), ${data.actualizadas} actualizada(s), ${data.agentesCreados} agente(s) nuevo(s), ${data.sinMonto} sin costo de flete todavía.`);
        await cargarTodo();
      } else {
        setNotifEstado('error'); setNotifMsg('❌ Error al sincronizar: ' + data.error);
      }
    } catch (e: any) {
      setNotifEstado('error'); setNotifMsg('❌ Error de conexión: ' + e.message);
    }
    setSincronizando(false);
  }

  async function handleEjecutar() {
    setEjecutando(true);
    setNotifEstado('enviando');
    setNotifMsg('Ejecutando el Agente de Administración…');
    try {
      const res = await fetch('/api/agente-administracion/run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setUltimoResumen(data);
        setNotifEstado('ok');
        setNotifMsg(`✅ Ejecutado (${data.modoSimulacion ? 'modo simulación' : 'envío real'}): ${data.notificacionesEnviadas.length} notificación(es), ${data.detalleErrores.length} con error.`);
        await cargarTodo();
      } else {
        setNotifEstado('error');
        setNotifMsg('❌ Error al ejecutar: ' + data.error);
      }
    } catch (e: any) {
      setNotifEstado('error');
      setNotifMsg('❌ Error de conexión: ' + e.message);
    }
    setEjecutando(false);
  }

  async function handleGuardarAgente() {
    if (!formAgente.nombre || !formAgente.email) {
      setNotifEstado('error'); setNotifMsg('Completa al menos Nombre y Email.'); return;
    }
    const body: any = {
      nombre: formAgente.nombre, pais: formAgente.pais, contacto: formAgente.contacto,
      email: formAgente.email, whatsapp: formAgente.whatsapp, tipo: 'agente_carga',
      dias_credito: formAgente.dias_credito === '' ? null : Number(formAgente.dias_credito),
      activo: true,
    };
    const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: 'return=representation' };
    try {
      const res = editandoAgenteId
        ? await fetch(`${SUPABASE_URL}/rest/v1/proveedores?id=eq.${editandoAgenteId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch(`${SUPABASE_URL}/rest/v1/proveedores`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) {
        setNotifEstado('ok'); setNotifMsg(`Agente "${body.nombre}" guardado.`);
        setFormAgenteAbierto(false); setFormAgente({ ...FORM_AGENTE_VACIO }); setEditandoAgenteId(null);
        await cargarTodo();
      } else { setNotifEstado('error'); setNotifMsg('Error al guardar el agente.'); }
    } catch (e: any) { setNotifEstado('error'); setNotifMsg('Error de conexión: ' + e.message); }
  }

  async function handleGuardarFactura() {
    if (!formFactura.numero_factura || !formFactura.embarque_bl || !formFactura.agente_id) {
      setNotifEstado('error'); setNotifMsg('Completa Número de Factura, Embarque y Agente Logístico.'); return;
    }
    const body: any = {
      numero_factura: formFactura.numero_factura, embarque_bl: formFactura.embarque_bl,
      agente_id: formFactura.agente_id, monto: formFactura.monto === '' ? null : Number(formFactura.monto),
      moneda: formFactura.moneda, fecha_factura: formFactura.fecha_factura || null,
      observaciones: formFactura.observaciones,
    };
    const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Prefer: 'return=representation' };
    try {
      const res = editandoFacturaId
        ? await fetch(`${SUPABASE_URL}/rest/v1/facturas?id=eq.${editandoFacturaId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch(`${SUPABASE_URL}/rest/v1/facturas`, { method: 'POST', headers, body: JSON.stringify({ ...body, estado_pago: 'Pendiente' }) });
      if (res.ok) {
        setNotifEstado('ok'); setNotifMsg(`Factura "${body.numero_factura}" guardada.`);
        setFormFacturaAbierto(false); setFormFactura({ ...FORM_FACTURA_VACIO }); setEditandoFacturaId(null);
        await cargarTodo();
      } else { setNotifEstado('error'); setNotifMsg('Error al guardar la factura.'); }
    } catch (e: any) { setNotifEstado('error'); setNotifMsg('Error de conexión: ' + e.message); }
  }

  async function handleMarcarPagada(f: any) {
    const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    await fetch(`${SUPABASE_URL}/rest/v1/facturas?id=eq.${f.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ estado_pago: 'Pagada', fecha_pago: hoyISO || new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }),
    });
    setNotifEstado('ok'); setNotifMsg(`Factura "${f.numero_factura}" marcada como Pagada. Ejecutando el motor para notificar al agente…`);
    // Correr el motor ahora mismo — así la notificación de pago al agente
    // (la única que sale hacia afuera) se genera de inmediato, sin esperar
    // al cron diario.
    await handleEjecutar();
  }

  async function abrirPreview(facturaId: string) {
    setPreviewFacturaId(facturaId);
    setPreviewAbierto(true);
    setCargandoPreview(true);
    setPreviewData(null);
    try {
      const res = await fetch('/api/agente-administracion/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facturaId }),
      });
      const data = await res.json();
      setPreviewData(data);
    } catch (e: any) {
      setPreviewData({ ok: false, error: e.message });
    }
    setCargandoPreview(false);
  }

  async function handleEnviarManual() {
    if (!previewFacturaId) return;
    setEnviandoManual(true);
    try {
      const res = await fetch('/api/agente-administracion/recordatorio-manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facturaId: previewFacturaId }),
      });
      const data = await res.json();
      if (data.ok) {
        setNotifEstado('ok');
        setNotifMsg(`✅ Recordatorio manual enviado (${data.modoSimulacion ? 'simulado' : 'real'}) a: ${data.destinatarios.join(', ')}.`);
        setPreviewAbierto(false);
        await cargarTodo();
      } else {
        setNotifEstado('error'); setNotifMsg('❌ ' + data.error);
      }
    } catch (e: any) {
      setNotifEstado('error'); setNotifMsg('❌ Error de conexión: ' + e.message);
    }
    setEnviandoManual(false);
  }

  const Tile = ({ label, valor, color }: { label: string; valor: number; color: string }) => (
    <div style={{ background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: 9, color: '#8b949e', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
    </div>
  );

  const GlobeSmall = () => (
    <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
      <defs>
        <radialGradient id="hgaa" cx="38%" cy="35%" r="65%"><stop offset="0%" stopColor="#1a3a5c" /><stop offset="100%" stopColor="#0a1628" /></radialGradient>
        <clipPath id="hcaa"><circle cx="40" cy="40" r="34" /></clipPath>
        <filter id="hglowaa"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx="40" cy="40" r="34" fill="url(#hgaa)" />
      <g clipPath="url(#hcaa)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.7" fill="none">
        <ellipse cx="40" cy="40" rx="34" ry="10" /><ellipse cx="40" cy="40" rx="34" ry="22" /><ellipse cx="40" cy="40" rx="34" ry="32" />
        <line x1="40" y1="6" x2="40" y2="74" /><ellipse cx="40" cy="40" rx="17" ry="34" /><ellipse cx="40" cy="40" rx="28" ry="34" />
      </g>
      <g clipPath="url(#hcaa)" stroke="#6eaadf" strokeWidth="0.9" fill="none" strokeOpacity="0.4">
        <path d="M22 32 Q32 14 50 22" /><path d="M50 22 Q62 28 58 44" /><path d="M14 42 Q18 36 22 32" />
      </g>
      <g filter="url(#hglowaa)">
        <circle cx="22" cy="32" r="2.8" fill="#7bbcf0" /><circle cx="50" cy="22" r="2.5" fill="#7bbcf0" />
        <circle cx="58" cy="44" r="2.5" fill="#7bbcf0" /><circle cx="14" cy="42" r="2" fill="#7bbcf0" />
      </g>
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(110,170,223,0.35)" strokeWidth="1" />
    </svg>
  );

  const inputStyle = { width: '100%', padding: '9px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', fontSize: 13 };
  const labelStyle = { fontSize: 11, color: '#8b949e', marginBottom: 4, display: 'block', textTransform: 'uppercase' as const, letterSpacing: 0.5 };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1421', color: '#e2eaf6', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64, gap: 16, backgroundColor: '#0d1421', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobeSmall />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: 1, color: '#e2eaf6' }}>Infinite<span style={{ color: '#5ba3e0' }}>X</span></div>
            <div style={{ fontSize: 10, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase' }}>Sistema Logístico</div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: '#5ba3e0', letterSpacing: 1, textTransform: 'uppercase' }}>Agente de Administración</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/" style={{ color: '#4a6280', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d29922', boxShadow: '0 0 7px #d29922', display: 'inline-block' }} />
            <span style={{ color: '#d29922', fontSize: 12, fontWeight: 500 }}>En Desarrollo</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#8b949e', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>PANEL DE SUPERVISION</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Agente de Administración</h1>
          <p style={{ color: '#8b949e', fontSize: 14, marginTop: 4 }}>Facturas de agentes logísticos — vencimiento por llegada al puerto + días de crédito</p>
        </div>

        {modoSimulacion && (
          <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, background: 'rgba(123,188,240,0.10)', border: '1px solid #7bbcf0', color: '#7bbcf0', fontSize: 13, fontWeight: 600 }}>
            ℹ MODO SIMULACIÓN ACTIVO — los correos se generan y se registran en la bitácora, pero no se envían de verdad hasta que se resuelva MailerSend.
          </div>
        )}

        {notifMsg && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
            background: notifEstado === 'error' ? 'rgba(248,81,73,0.12)' : notifEstado === 'enviando' ? 'rgba(88,166,255,0.1)' : 'rgba(63,185,80,0.12)',
            border: `1px solid ${notifEstado === 'error' ? '#f85149' : notifEstado === 'enviando' ? '#58a6ff' : '#3fb950'}`,
            color: notifEstado === 'error' ? '#f85149' : notifEstado === 'enviando' ? '#58a6ff' : '#3fb950', fontSize: 13,
          }}>{notifMsg}</div>
        )}

        <div style={{ marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleEjecutar} disabled={ejecutando} style={{ background: '#58a6ff', color: '#0d1117', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: ejecutando ? 'not-allowed' : 'pointer', opacity: ejecutando ? 0.6 : 1 }}>
            {ejecutando ? '⏳ Ejecutando…' : '▶ Ejecutar Ahora'}
          </button>
          <button onClick={handleSincronizarMonday} disabled={sincronizando} style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid #00d4aa44', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: sincronizando ? 'not-allowed' : 'pointer', opacity: sincronizando ? 0.6 : 1 }}>
            {sincronizando ? '⏳ Sincronizando…' : '🔄 Sincronizar Facturas desde Monday'}
          </button>
          <button onClick={() => { setFormFacturaAbierto(!formFacturaAbierto); setEditandoFacturaId(null); setFormFactura({ ...FORM_FACTURA_VACIO }); }} style={{ background: formFacturaAbierto ? '#21262d' : 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {formFacturaAbierto ? '✕ Cancelar' : '+ Nueva Factura'}
          </button>
          <button onClick={() => { setFormAgenteAbierto(!formAgenteAbierto); setEditandoAgenteId(null); setFormAgente({ ...FORM_AGENTE_VACIO }); }} style={{ background: formAgenteAbierto ? '#21262d' : 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid #a78bfa44', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {formAgenteAbierto ? '✕ Cancelar' : '+ Agente Logístico'}
          </button>
        </div>

        {/* Tiles resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10, marginBottom: 28 }}>
          <Tile label="Pendientes" valor={resumenVivo.pendientes} color="#58a6ff" />
          <Tile label="Vencen 7d" valor={resumenVivo.vencen7d} color="#1f6feb" />
          <Tile label="Vencen 3d" valor={resumenVivo.vencen3d} color="#d29922" />
          <Tile label="Vencen mañana" valor={resumenVivo.vencenManana} color="#d9730d" />
          <Tile label="Vencen hoy" valor={resumenVivo.vencenHoy} color="#c0261f" />
          <Tile label="Vencidas" valor={resumenVivo.vencidas} color="#f85149" />
          <Tile label="Pagadas" valor={resumenVivo.pagadas} color="#3fb950" />
          <Tile label="Con errores" valor={resumenVivo.conErrores} color="#f85149" />
        </div>

        {/* Form Agente */}
        {formAgenteAbierto && (
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{editandoAgenteId ? 'Editar' : 'Nuevo'} Agente Logístico</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Nombre</label><input style={inputStyle} value={formAgente.nombre} onChange={e => setFormAgente({ ...formAgente, nombre: e.target.value })} placeholder="ej. Anker Logistics" /></div>
              <div><label style={labelStyle}>País</label><input style={inputStyle} value={formAgente.pais} onChange={e => setFormAgente({ ...formAgente, pais: e.target.value })} /></div>
              <div><label style={labelStyle}>Días de Crédito</label><input type="number" style={inputStyle} value={formAgente.dias_credito} onChange={e => setFormAgente({ ...formAgente, dias_credito: e.target.value })} placeholder="0 / 7 / 15 / 30" /></div>
              <div><label style={labelStyle}>Email</label><input style={inputStyle} value={formAgente.email} onChange={e => setFormAgente({ ...formAgente, email: e.target.value })} /></div>
              <div><label style={labelStyle}>Contacto</label><input style={inputStyle} value={formAgente.contacto} onChange={e => setFormAgente({ ...formAgente, contacto: e.target.value })} /></div>
              <div><label style={labelStyle}>WhatsApp</label><input style={inputStyle} value={formAgente.whatsapp} onChange={e => setFormAgente({ ...formAgente, whatsapp: e.target.value })} /></div>
            </div>
            <button onClick={handleGuardarAgente} style={{ background: '#3fb950', color: '#0d1117', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar Agente</button>
          </div>
        )}

        {/* Form Factura */}
        {formFacturaAbierto && (
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{editandoFacturaId ? 'Editar' : 'Nueva'} Factura</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Número de Factura</label><input style={inputStyle} value={formFactura.numero_factura} onChange={e => setFormFactura({ ...formFactura, numero_factura: e.target.value })} /></div>
              <div>
                <label style={labelStyle}>Embarque (BL)</label>
                <select style={inputStyle} value={formFactura.embarque_bl} onChange={e => setFormFactura({ ...formFactura, embarque_bl: e.target.value })}>
                  <option value="">-- Seleccionar --</option>
                  {embarques.map((e: any) => <option key={e.bl} value={e.bl}>{e.bl} — {e.descripcion || e.naviera}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Agente Logístico</label>
                <select style={inputStyle} value={formFactura.agente_id} onChange={e => setFormFactura({ ...formFactura, agente_id: e.target.value })}>
                  <option value="">-- Seleccionar --</option>
                  {agentesLogisticos.map((a: any) => <option key={a.id} value={a.id}>{a.nombre} {a.dias_credito != null ? `(${a.dias_credito}d)` : '(sin crédito)'}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Monto</label><input type="number" style={inputStyle} value={formFactura.monto} onChange={e => setFormFactura({ ...formFactura, monto: e.target.value })} /></div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select style={inputStyle} value={formFactura.moneda} onChange={e => setFormFactura({ ...formFactura, moneda: e.target.value })}>
                  {['USD', 'EUR', 'CNY', 'INR'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Fecha de Factura</label><input type="date" style={inputStyle} value={formFactura.fecha_factura} onChange={e => setFormFactura({ ...formFactura, fecha_factura: e.target.value })} /></div>
              <div style={{ gridColumn: 'span 3' }}><label style={labelStyle}>Observaciones</label><input style={inputStyle} value={formFactura.observaciones} onChange={e => setFormFactura({ ...formFactura, observaciones: e.target.value })} /></div>
            </div>
            <button onClick={handleGuardarFactura} style={{ background: '#3fb950', color: '#0d1117', border: 'none', borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Guardar Factura</button>
          </div>
        )}

        {/* Tabla Facturas */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Facturas ({facturasConDatos.length})</h3>
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0d1117', textAlign: 'left' }}>
                  {['Factura', 'Embarque', 'Agente', 'Monto', 'Llegada Puerto', 'Vencimiento', 'Días', 'Estado', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facturasConDatos.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: '#8b949e' }}>Sin facturas registradas. Agrega la primera con el botón de arriba.</td></tr>
                )}
                {facturasConDatos.map((f: any) => {
                  const agente = f.agente_id ? proveedorPorId.get(f.agente_id) : null;
                  const embarque = f.embarque_bl ? embarquePorBl.get(f.embarque_bl) : null;
                  const est = ESTADO_STYLE[f.estadoVivo] || ESTADO_STYLE['Pendiente'];
                  return (
                    <tr key={f.id} style={{ borderTop: '1px solid #21262d' }}>
                      <td style={{ padding: '10px 12px' }}>{f.numero_factura}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e' }}>{f.embarque_bl}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e' }}>{agente?.nombre || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>{f.monto != null ? `${f.moneda} ${Number(f.monto).toLocaleString()}` : '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e' }}>{embarque?.llegada_real || '-'}</td>
                      <td style={{ padding: '10px 12px', color: '#8b949e' }}>{f.vencimiento || '-'}</td>
                      <td style={{ padding: '10px 12px', color: f.diasRestantes != null && f.diasRestantes < 0 ? '#f85149' : '#8b949e' }}>{f.diasRestantes ?? '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: est.bg, color: est.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{f.error ? '⚠ ' + f.error : f.estadoVivo}</span>
                      </td>
                      <td style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                        <button onClick={() => abrirPreview(f.id)} style={{ background: 'rgba(88,166,255,0.12)', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>👁 Vista Previa</button>
                        {f.estado_pago !== 'Pagada' && (
                          <button onClick={() => handleMarcarPagada(f)} style={{ background: 'rgba(63,185,80,0.12)', color: '#3fb950', border: '1px solid #3fb95044', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>Marcar Pagada</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maestro de Agentes Logísticos */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Maestro de Agentes Logísticos ({agentesLogisticos.length})</h3>
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0d1117', textAlign: 'left' }}>
                  {['Nombre', 'País', 'Email', 'Contacto', 'Días de Crédito'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agentesLogisticos.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8b949e' }}>Sin agentes logísticos registrados todavía.</td></tr>
                )}
                {agentesLogisticos.map((a: any) => (
                  <tr key={a.id} style={{ borderTop: '1px solid #21262d' }}>
                    <td style={{ padding: '10px 12px' }}>{a.nombre}</td>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{a.pais || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{a.email || '-'}</td>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{a.contacto || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>{a.dias_credito != null ? `${a.dias_credito} días` : <span style={{ color: '#f85149' }}>Sin definir</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bitácora */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Bitácora de Notificaciones ({bitacora.length})</h3>
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#0d1117', textAlign: 'left' }}>
                  {['Fecha', 'Tipo', 'Destinatario', 'Asunto', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bitacora.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8b949e' }}>Sin notificaciones registradas todavía — corre "Ejecutar Ahora" para generar la primera tanda.</td></tr>
                )}
                {bitacora.map((n: any) => (
                  <tr key={n.id} style={{ borderTop: '1px solid #21262d' }}>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{new Date(n.fecha_hora).toLocaleString('es-PA')}</td>
                    <td style={{ padding: '10px 12px' }}>{n.tipo_notificacion}</td>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{n.destinatario}</td>
                    <td style={{ padding: '10px 12px', color: '#8b949e' }}>{n.asunto}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: n.estado_envio === 'error' ? 'rgba(248,81,73,0.15)' : n.estado_envio === 'simulado' ? 'rgba(210,153,34,0.15)' : 'rgba(63,185,80,0.15)',
                        color: n.estado_envio === 'error' ? '#f85149' : n.estado_envio === 'simulado' ? '#d29922' : '#3fb950',
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      }}>{n.estado_envio}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 40, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#2d3f55' }}>
        <span style={{ fontWeight: 500, color: '#3d4f66' }}>InfiniteX · Sicoben Ediciones Panama</span>
        <span>KADI INTERNATIONAL S.A. © 2026</span>
      </div>

      {previewAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={() => setPreviewAbierto(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d1117', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #30363d', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Vista Previa — así le llega a los destinatarios</div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>
                  {cargandoPreview ? 'Cargando…' : previewData?.interno ? `Interno → Administración · tipo: ${previewData.interno.tipo}` : previewData?.pago ? 'Externo → Agente logístico (notificación de pago)' : 'Sin correo generable todavía'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {previewData?.interno && (
                  <button onClick={handleEnviarManual} disabled={enviandoManual} style={{ background: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: '1px solid #58a6ff44', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: enviandoManual ? 'not-allowed' : 'pointer', opacity: enviandoManual ? 0.6 : 1 }}>
                    {enviandoManual ? '⏳ Enviando…' : '✉️ Enviar Ahora'}
                  </button>
                )}
                <button onClick={() => setPreviewAbierto(false)} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#f0f4f8', padding: 16 }}>
              {cargandoPreview && <div style={{ color: '#4a5568', padding: 20 }}>Cargando vista previa…</div>}
              {!cargandoPreview && !previewData?.interno && !previewData?.pago && (
                <div style={{ color: '#4a5568', padding: 20 }}>
                  Todavía no hay suficiente información (agente, llegada al puerto o crédito) para generar el correo de esta factura.
                </div>
              )}
              {!cargandoPreview && previewData?.pago && (
                <>
                  <div style={{ fontSize: 11, color: '#3fb950', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Notificación de pago al agente</div>
                  <iframe srcDoc={previewData.pago.html} style={{ width: '100%', height: 360, border: '1px solid #d0d7de', borderRadius: 8, background: '#fff', marginBottom: 16 }} title="Preview pago" />
                </>
              )}
              {!cargandoPreview && previewData?.interno && (
                <>
                  <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>Aviso interno — Administración</div>
                  <iframe srcDoc={previewData.interno.html} style={{ width: '100%', height: 420, border: '1px solid #d0d7de', borderRadius: 8, background: '#fff' }} title="Preview interno" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
