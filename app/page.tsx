'use client';

export default function Home() {
  const agentes = [
    { num: '01', nombre: 'Orquestador Central', area: 'Hub / Router — Aprobaciones', estado: 'desarrollo', ruta: '/orquestador',    icono: '⚙️' },
    { num: '02', nombre: 'Agente Bodega',        area: 'Bodega Anker',               estado: 'pendiente',  ruta: null,              icono: '📦' },
    { num: '03', nombre: 'Agente Ventas',         area: 'Comercial / Ventas',         estado: 'pendiente',  ruta: null,              icono: '📊' },
    { num: '04', nombre: 'Agente Despacho',       area: 'Despacho y Entrega',         estado: 'pendiente',  ruta: null,              icono: '🚚' },
    { num: '05', nombre: 'Agente Clientes',       area: 'Servicio al Cliente',        estado: 'pendiente',  ruta: null,              icono: '👥' },
    { num: '06', nombre: 'Agente Tráfico',        area: 'Produccion / Logística',     estado: 'activo',     ruta: '/agente-trafico', icono: '🌐' },
    { num: '07', nombre: 'Agente Administración', area: 'Administración General',     estado: 'pendiente',  ruta: null,              icono: '🗂️' },
  ];

  const operativos   = agentes.filter(a => a.estado === 'activo').length;
  const enDesarrollo = agentes.filter(a => a.estado === 'desarrollo').length;
  const pendientes   = agentes.filter(a => a.estado === 'pendiente').length;

  const GlobeSmall = () => (
    <svg width="38" height="38" viewBox="0 0 80 80" fill="none">
      <defs>
        <radialGradient id="hg" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#1a3a5c"/>
          <stop offset="100%" stopColor="#0a1628"/>
        </radialGradient>
        <clipPath id="hc"><circle cx="40" cy="40" r="34"/></clipPath>
        <filter id="hglow"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="40" cy="40" r="34" fill="url(#hg)"/>
      <g clipPath="url(#hc)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.7" fill="none">
        <ellipse cx="40" cy="40" rx="34" ry="10"/>
        <ellipse cx="40" cy="40" rx="34" ry="22"/>
        <ellipse cx="40" cy="40" rx="34" ry="32"/>
        <line x1="40" y1="6" x2="40" y2="74"/>
        <ellipse cx="40" cy="40" rx="17" ry="34"/>
        <ellipse cx="40" cy="40" rx="28" ry="34"/>
      </g>
      <g clipPath="url(#hc)" stroke="#6eaadf" strokeWidth="0.9" fill="none" strokeOpacity="0.4">
        <path d="M22 32 Q32 14 50 22"/>
        <path d="M50 22 Q62 28 58 44"/>
        <path d="M22 32 Q20 50 30 58"/>
        <path d="M14 42 Q18 36 22 32"/>
      </g>
      <path d="M22 32 Q32 14 50 22" stroke="#b8d8f8" strokeWidth="1.5" fill="none" className="ix-hr1" strokeLinecap="round"/>
      <path d="M50 22 Q62 28 58 44" stroke="#b8d8f8" strokeWidth="1.5" fill="none" className="ix-hr2" strokeLinecap="round"/>
      <path d="M14 42 Q18 36 22 32" stroke="#b8d8f8" strokeWidth="1.5" fill="none" className="ix-hr4" strokeLinecap="round"/>
      <g filter="url(#hglow)">
        <circle className="ix-node"   cx="22" cy="32" r="2.8" fill="#7bbcf0"/>
        <circle className="ix-node-2" cx="50" cy="22" r="2.5" fill="#7bbcf0"/>
        <circle className="ix-node-3" cx="58" cy="44" r="2.5" fill="#7bbcf0"/>
        <circle className="ix-node-5" cx="14" cy="42" r="2"   fill="#7bbcf0"/>
      </g>
      <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(110,170,223,0.35)" strokeWidth="1"/>
      <ellipse cx="32" cy="28" rx="9" ry="5" fill="rgba(255,255,255,0.05)" transform="rotate(-20,32,28)"/>
    </svg>
  );

  const GlobeLarge = () => (
    <svg width="260" height="260" viewBox="0 0 200 200" fill="none">
      <defs>
        <radialGradient id="bg2" cx="36%" cy="34%" r="65%">
          <stop offset="0%" stopColor="#0e2a50"/>
          <stop offset="100%" stopColor="#060e1e"/>
        </radialGradient>
        <clipPath id="gc2"><circle cx="100" cy="100" r="90"/></clipPath>
        <filter id="glow2"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(110,170,223,0.07)" strokeWidth="4"/>
      <circle cx="100" cy="100" r="90" fill="url(#bg2)"/>
      <g clipPath="url(#gc2)" stroke="rgba(110,170,223,0.18)" strokeWidth="0.8" fill="none">
        <ellipse cx="100" cy="100" rx="90" ry="22"/>
        <ellipse cx="100" cy="100" rx="90" ry="46"/>
        <ellipse cx="100" cy="100" rx="90" ry="68"/>
        <ellipse cx="100" cy="100" rx="90" ry="82"/>
        <line x1="100" y1="10" x2="100" y2="190"/>
        <ellipse cx="100" cy="100" rx="44" ry="90"/>
        <ellipse cx="100" cy="100" rx="72" ry="90"/>
      </g>
      <g clipPath="url(#gc2)" stroke="#6eaadf" strokeWidth="1.2" fill="none" strokeOpacity="0.35">
        <path d="M54 88 Q78 40 128 62"/>
        <path d="M54 88 Q70 60 88 52"/>
        <path d="M88 52 Q108 42 128 62"/>
        <path d="M128 62 Q148 80 144 108"/>
        <path d="M54 88 Q48 116 60 140"/>
        <path d="M36 68 Q44 78 54 88"/>
        <path d="M144 108 Q130 140 110 148"/>
        <path d="M110 148 Q80 158 60 140"/>
      </g>
      <path d="M54 88 Q78 40 128 62"    stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route1" strokeLinecap="round"/>
      <path d="M88 52 Q108 42 128 62"   stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route2" strokeLinecap="round"/>
      <path d="M54 88 Q48 116 60 140"   stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route3" strokeLinecap="round"/>
      <path d="M128 62 Q148 80 144 108" stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route4" strokeLinecap="round"/>
      <path d="M36 68 Q44 78 54 88"     stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route5" strokeLinecap="round"/>
      <path d="M110 148 Q80 158 60 140" stroke="#c8e4ff" strokeWidth="2" fill="none" className="ix-route6" strokeLinecap="round"/>
      <g filter="url(#glow2)">
        <circle className="ix-node"   cx="54"  cy="88"  r="5.5" fill="#7bbcf0"/>
        <circle className="ix-node-2" cx="128" cy="62"  r="4.5" fill="#7bbcf0"/>
        <circle className="ix-node-3" cx="88"  cy="52"  r="4"   fill="#7bbcf0"/>
        <circle className="ix-node-4" cx="144" cy="108" r="4"   fill="#7bbcf0"/>
        <circle className="ix-node-5" cx="60"  cy="140" r="3.5" fill="#7bbcf0"/>
        <circle className="ix-node-6" cx="36"  cy="68"  r="3.5" fill="#7bbcf0"/>
        <circle className="ix-node-7" cx="110" cy="148" r="3.5" fill="#7bbcf0"/>
      </g>
      <circle cx="54" cy="88" r="11" fill="none" stroke="#7bbcf0" strokeWidth="0.8" strokeOpacity="0.3" className="ix-halo"/>
      <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(110,170,223,0.3)" strokeWidth="1"/>
      <ellipse cx="78" cy="68" rx="22" ry="12" fill="rgba(255,255,255,0.05)" transform="rotate(-25,78,68)"/>
    </svg>
  );

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0d1421', color: '#e2eaf6', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── HEADER ── */}
      <header style={{
        height: 64, padding: '0 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backgroundColor: '#0d1421',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobeSmall />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: 1, color: '#e2eaf6' }}>
              Infinite<span style={{ color: '#5ba3e0' }}>X</span>
            </div>
            <div style={{ fontSize: 10, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase' }}>Sistema Logístico</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 28 }}>
          {[
            { label: 'Dashboard', active: true },
            { label: 'Agentes',   active: false },
            { label: 'Historial', active: false },
            { label: 'Config',    active: false },
          ].map(n => (
            <a key={n.label} href="#" style={{
              fontSize: 13, fontWeight: n.active ? 500 : 400,
              color: n.active ? '#e2eaf6' : '#4a6280',
              textDecoration: 'none',
            }}>{n.label}</a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3aaa6e', boxShadow: '0 0 8px #3aaa6e', display: 'inline-block' }} className="ix-halo"/>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#3aaa6e', letterSpacing: 0.5 }}>Sistema Activo</span>
        </div>
      </header>

      {/* ── HERO ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '64px 48px 52px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, rgba(91,163,224,0.04) 0%, transparent 60%)',
        overflow: 'hidden',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#5ba3e0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ width: 24, height: 1, background: '#5ba3e0', display: 'inline-block' }}/>
            Panel de Control — Sicoben Ediciones
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 300, lineHeight: 1.1, color: '#e2eaf6', marginBottom: 16 }}>
            Sistema de<br />
            <strong style={{ fontWeight: 700, color: '#f0f6ff' }}>Agentes Logísticos</strong>
          </h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: '#4a6280' }}>
            Kadi Internacional S.A. · Panama
          </p>
        </div>
        <GlobeLarge />
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label: 'Total Agentes',  value: agentes.length, color: '#e2eaf6' },
          { label: 'En Desarrollo',  value: enDesarrollo,   color: '#5ba3e0' },
          { label: 'Pendientes',     value: pendientes,     color: '#7a8fa8' },
          { label: 'Operativos',     value: operativos,     color: '#3aaa6e' },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '28px 36px',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: '#4a6280', marginBottom: 10 }}>{s.label}</p>
            <p style={{ fontSize: 38, fontWeight: 300, color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── AGENTS CARDS ── */}
      <div style={{ padding: '40px 48px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2eaf6', marginBottom: 4 }}>Agentes del Sistema</h2>
            <p style={{ fontSize: 12, color: '#4a6280', fontWeight: 400 }}>Módulos de inteligencia artificial especializados</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {agentes.map(a => {
            const isActivo = a.estado === 'activo';
            const isDev    = a.estado === 'desarrollo';

            return (
              <div
                key={a.num}
                onClick={() => a.ruta && (window.location.href = a.ruta)}
                style={{
                  backgroundColor: '#111827',
                  border: `1px solid ${isActivo ? 'rgba(58,170,110,0.3)' : isDev ? 'rgba(91,163,224,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12,
                  padding: '22px 24px',
                  cursor: a.ruta ? 'pointer' : 'default',
                  transition: 'border-color 0.2s, background 0.2s',
                  background: isActivo
                    ? 'linear-gradient(145deg, #111827, rgba(58,170,110,0.05))'
                    : isDev
                    ? 'linear-gradient(145deg, #111827, rgba(91,163,224,0.05))'
                    : '#111827',
                }}
              >
                {/* Card top */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{a.icono}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#2a3a50', letterSpacing: 2, textTransform: 'uppercase' }}>#{a.num}</span>
                  </div>
                  {/* Badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 600, letterSpacing: 0.8,
                    padding: '4px 12px', borderRadius: 20,
                    textTransform: 'uppercase',
                    ...(isActivo
                      ? { color: '#3aaa6e', background: 'rgba(58,170,110,0.12)', border: '1px solid rgba(58,170,110,0.3)' }
                      : isDev
                      ? { color: '#5ba3e0', background: 'rgba(91,163,224,0.12)', border: '1px solid rgba(91,163,224,0.3)' }
                      : { color: '#4a6280', background: 'rgba(74,98,128,0.1)',   border: '1px solid rgba(74,98,128,0.2)' }),
                  }}>
                    {(isActivo || isDev) && (
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}/>
                    )}
                    {isActivo ? 'Operativo' : isDev ? 'En Desarrollo' : 'Pendiente'}
                  </span>
                </div>

                {/* Name + area */}
                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e2eaf6', marginBottom: 6 }}>{a.nombre}</h3>
                <p style={{ fontSize: 12, fontWeight: 400, color: '#4a6280' }}>{a.area}</p>

                {/* CTA */}
                {a.ruta && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${isActivo ? 'rgba(58,170,110,0.15)' : 'rgba(91,163,224,0.12)'}` }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: isActivo ? '#3aaa6e' : '#5ba3e0' }}>
                      Abrir módulo →
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '18px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2a3a50', letterSpacing: 1 }}>InfiniteX</span>
          <span style={{ fontSize: 12, fontWeight: 300, color: '#2a3a50' }}>· Sicoben Ediciones Panama</span>
        </div>
        <span style={{ fontSize: 11, color: '#1e2c3d', letterSpacing: 0.5 }}>KADI INTERNATIONAL S.A. © 2026</span>
      </footer>

    </main>
  );
}
