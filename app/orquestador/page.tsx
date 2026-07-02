'use client';
import { useEffect, useState } from 'react';

const SUPABASE_URL = 'https://aoueqkinzrhawzfsiulv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWVxa2luenJoYXd6ZnNpdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzMxNTEsImV4cCI6MjA2NTM0OTE1MX0.Oa8HbKMOa8LGsiDIj3ROmIJkDpVQFNoiym3HAdTMW9w';

export default function OrquestadorPage() {
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [notif, setNotif] = useState('');
  const [notifTipo, setNotifTipo] = useState('ok');
  const [vistaHistorial, setVistaHistorial] = useState(false);

  useEffect(() => {
    cargarMensajes();
  }, []);

  async function cargarMensajes() {
    setCargando(true);
    try {
      const [resPend, resHist] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/message_queue?status=eq.pending_approval&order=priority.asc,created_at.asc`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        }),
        fetch(`${SUPABASE_URL}/rest/v1/message_queue?status=in.(approved,rejected)&order=updated_at.desc&limit=20`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        }),
      ]);
      const pend = await resPend.json();
      const hist = await resHist.json();
      setMensajes(Array.isArray(pend) ? pend : []);
      setHistorial(Array.isArray(hist) ? hist : []);
    } catch (e: any) {
      setNotif('Error al cargar mensajes: ' + e.message);
      setNotifTipo('error');
    }
    setCargando(false);
  }

  async function handleAprobar(msg: any) {
    setProcesando(msg.id);
    setNotif('');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/message_queue?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'approved', processed_at: new Date().toISOString() }),
      });

      if (res.ok) {
        // Intentar enviar via edge function
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/agente-notificador`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify({
              accion: 'enviar_aprobado',
              queue_id: msg.id,
              ...msg.payload,
            }),
          });
        } catch (_) {}

        setMensajes(prev => prev.filter(m => m.id !== msg.id));
        setNotifTipo('ok');
        setNotif(`✅ Aprobado y enviado: ${msg.payload?.asunto || msg.id}`);
      } else {
        setNotifTipo('error');
        setNotif(`Error al aprobar (${res.status}).`);
      }
    } catch (e: any) {
      setNotifTipo('error');
      setNotif('Error de conexión: ' + e.message);
    }
    setProcesando(null);
  }

  async function handleRechazar(msg: any) {
    setProcesando(msg.id);
    setNotif('');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/message_queue?id=eq.${msg.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'rejected', processed_at: new Date().toISOString() }),
      });

      if (res.ok) {
        setMensajes(prev => prev.filter(m => m.id !== msg.id));
        setNotifTipo('ok');
        setNotif(`Notificación rechazada: ${msg.payload?.embarque?.bl || 'sin BL'}`);
      } else {
        setNotifTipo('error');
        setNotif(`Error al rechazar (${res.status}).`);
      }
    } catch (e: any) {
      setNotifTipo('error');
      setNotif('Error de conexión: ' + e.message);
    }
    setProcesando(null);
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, display: 'block',
  };

  const urgentes = mensajes.filter(m => m.priority === 1).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', padding: '0 32px', display: 'flex', alignItems: 'center', height: 56, gap: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 3 }}>
          <span style={{ color: '#58a6ff' }}>INFINITE</span>
          <span style={{ color: '#ffffff' }}> X</span>
        </span>
        <span style={{ color: '#8b949e', fontSize: 12, letterSpacing: 2 }}>ORQUESTADOR CENTRAL</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="/" style={{ color: '#8b949e', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
          <span style={{ color: '#3fb950', fontSize: 13 }}>● Operativo</span>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px' }}>
        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: '#8b949e', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>HUB / ROUTER</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Orquestador Central</h1>
          <p style={{ color: '#8b949e', fontSize: 14, marginTop: 4 }}>Autorización de mensajes salientes — InfiniteX</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div style={{ background: mensajes.length > 0 ? 'rgba(88,166,255,0.08)' : '#161b22', border: `1px solid ${mensajes.length > 0 ? '#58a6ff44' : '#21262d'}`, borderRadius: 10, padding: '16px 24px', minWidth: 150 }}>
            <p style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Pendientes Aprobación</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: mensajes.length > 0 ? '#58a6ff' : '#e6edf3', margin: 0 }}>{mensajes.length}</p>
          </div>
          {urgentes > 0 && (
            <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid #f8514944', borderRadius: 10, padding: '16px 24px', minWidth: 150 }}>
              <p style={{ fontSize: 10, color: '#f85149', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>🚨 Urgentes (CRÍTICO)</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#f85149', margin: 0 }}>{urgentes}</p>
            </div>
          )}
          <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '16px 24px', minWidth: 150 }}>
            <p style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Procesados Recientes</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#3fb950', margin: 0 }}>{historial.length}</p>
          </div>
        </div>

        {/* Notificacion */}
        {notif && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
            background: notifTipo === 'error' ? 'rgba(248,81,73,0.12)' : 'rgba(63,185,80,0.12)',
            border: `1px solid ${notifTipo === 'error' ? '#f85149' : '#3fb950'}`,
            color: notifTipo === 'error' ? '#f85149' : '#3fb950', fontSize: 13,
          }}>
            {notif}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center' }}>
          <button
            onClick={() => { setVistaHistorial(false); }}
            style={{
              background: !vistaHistorial ? '#58a6ff' : 'transparent',
              color: !vistaHistorial ? '#0d1117' : '#8b949e',
              border: !vistaHistorial ? 'none' : '1px solid #21262d',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Pendientes ({mensajes.length})
          </button>
          <button
            onClick={() => { setVistaHistorial(true); }}
            style={{
              background: vistaHistorial ? '#58a6ff' : 'transparent',
              color: vistaHistorial ? '#0d1117' : '#8b949e',
              border: vistaHistorial ? 'none' : '1px solid #21262d',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Historial ({historial.length})
          </button>
          <button
            onClick={cargarMensajes}
            style={{
              marginLeft: 'auto', background: 'transparent', color: '#8b949e',
              border: '1px solid #21262d', borderRadius: 8, padding: '8px 14px',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            ↻ Actualizar
          </button>
        </div>

        {/* PENDIENTES */}
        {!vistaHistorial && (
          <>
            {cargando ? (
              <div style={{ textAlign: 'center', color: '#8b949e', padding: 40 }}>Cargando mensajes...</div>
            ) : mensajes.length === 0 ? (
              <div style={{
                background: '#161b22', border: '1px solid #21262d', borderRadius: 12,
                padding: 40, textAlign: 'center', color: '#8b949e',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>Sin mensajes pendientes</p>
                <p style={{ fontSize: 13 }}>Todos los mensajes han sido procesados.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {mensajes.map(msg => {
                  const emb = msg.payload?.embarque || {};
                  const urgente = msg.priority === 1;
                  const auto = msg.payload?.automatico;
                  return (
                    <div key={msg.id} style={{
                      background: '#161b22',
                      border: `1px solid ${urgente ? '#f8514955' : '#21262d'}`,
                      borderLeft: `3px solid ${urgente ? '#f85149' : '#58a6ff'}`,
                      borderRadius: 12, padding: 24,
                    }}>
                      {/* Header msg */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            {urgente && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(248,81,73,0.15)', color: '#f85149', border: '1px solid #f8514933' }}>🚨 URGENTE</span>}
                            {auto && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid #3fb95033' }}>⚡ Automático</span>}
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(88,166,255,0.1)', color: '#58a6ff', border: '1px solid #58a6ff33' }}>Agente Tráfico</span>
                          </div>
                          <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{msg.payload?.asunto || 'Sin asunto'}</p>
                          <p style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                            {new Date(msg.created_at).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                        {/* Botones aprobación */}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => handleAprobar(msg)}
                            disabled={procesando === msg.id}
                            style={{
                              background: procesando === msg.id ? '#21262d' : '#3fb950',
                              color: procesando === msg.id ? '#8b949e' : '#0d1117',
                              border: 'none', borderRadius: 8, padding: '10px 22px',
                              fontSize: 14, fontWeight: 700, cursor: procesando === msg.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {procesando === msg.id ? 'Procesando...' : '✓ Aprobar y Enviar'}
                          </button>
                          <button
                            onClick={() => handleRechazar(msg)}
                            disabled={procesando === msg.id}
                            style={{
                              background: 'transparent', color: '#f85149',
                              border: '1px solid #f8514944', borderRadius: 8,
                              padding: '10px 16px', fontSize: 14, cursor: procesando === msg.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ✕ Rechazar
                          </button>
                        </div>
                      </div>

                      {/* Datos embarque */}
                      {emb.bl && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                          {[
                            ['BL / Booking', emb.bl],
                            ['Proveedor', emb.proveedor],
                            ['Estado', emb.estado],
                            ['ETA (Llegada)', emb.eta || '-'],
                          ].map(([lbl, val]) => (
                            <div key={lbl as string} style={{ background: '#0d1117', borderRadius: 8, padding: '10px 14px' }}>
                              <label style={labelStyle}>{lbl as string}</label>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: lbl === 'Estado' ? '#58a6ff' : '#e6edf3' }}>{val as string}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Preview mensaje */}
                      <details style={{ cursor: 'pointer' }}>
                        <summary style={{ fontSize: 12, color: '#8b949e', marginBottom: 8, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>▶ Ver mensaje completo</span>
                        </summary>
                        <pre style={{
                          background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
                          padding: '14px 16px', fontSize: 12, color: '#8b949e',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8,
                        }}>
                          {msg.payload?.mensaje_texto || JSON.stringify(msg.payload, null, 2)}
                        </pre>
                      </details>

                      {/* Destinatarios */}
                      {msg.payload?.destinatarios && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#8b949e' }}>Destinatarios:</span>
                          {msg.payload.destinatarios.map((d: any) => (
                            <span key={d.email} style={{
                              fontSize: 11, padding: '2px 10px', borderRadius: 20,
                              background: 'rgba(139,148,158,0.1)', color: '#8b949e', border: '1px solid #21262d',
                            }}>
                              {d.nombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* HISTORIAL */}
        {vistaHistorial && (
          <div>
            {historial.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8b949e', padding: 40 }}>Sin historial aún.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {historial.map(msg => (
                  <div key={msg.id} style={{
                    background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
                    padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{msg.payload?.asunto || 'Sin asunto'}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#8b949e' }}>
                        {new Date(msg.processed_at || msg.updated_at).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' })}
                        {' · '}BL: {msg.payload?.embarque?.bl || '-'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 12, padding: '3px 12px', borderRadius: 20,
                      background: msg.status === 'approved' ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)',
                      color: msg.status === 'approved' ? '#3fb950' : '#f85149',
                      border: `1px solid ${msg.status === 'approved' ? '#3fb95033' : '#f8514933'}`,
                    }}>
                      {msg.status === 'approved' ? '✓ Enviado' : '✕ Rechazado'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
