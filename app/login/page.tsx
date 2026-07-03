'use client';
import { useState, useEffect } from 'react';

function playConnectionSound() {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, ctx.currentTime);
    master.connect(ctx.destination);

    // Etapa 1: Ruido digital inicial (sawtooth burst)
    const burst = ctx.createOscillator();
    const burstGain = ctx.createGain();
    burst.type = 'sawtooth';
    burst.frequency.setValueAtTime(60, ctx.currentTime);
    burst.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.18);
    burstGain.gain.setValueAtTime(0.08, ctx.currentTime);
    burstGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    burst.connect(burstGain); burstGain.connect(master);
    burst.start(ctx.currentTime); burst.stop(ctx.currentTime + 0.22);

    // Etapa 2: Barrido ascendente (sistema cargando)
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(120, ctx.currentTime + 0.15);
    sweep.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.65);
    sweepGain.gain.setValueAtTime(0.18, ctx.currentTime + 0.15);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    sweep.connect(sweepGain); sweepGain.connect(master);
    sweep.start(ctx.currentTime + 0.15); sweep.stop(ctx.currentTime + 0.72);

    // Etapa 3: Tres pitidos de confirmación
    [[0.78, 700], [0.87, 900], [0.94, 1100]].forEach(([t, f]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      g.gain.setValueAtTime(0.14, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.09);
      osc.connect(g); g.connect(master);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.12);
    });

    // Etapa 4: Acorde final de conexión (C mayor extendido)
    [[1.05, 523], [1.08, 659], [1.11, 784], [1.14, 1047]].forEach(([t, f]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      g.gain.setValueAtTime(0.13, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 1.4);
      osc.connect(g); g.connect(master);
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 1.5);
    });
  } catch (_) {}
}

export default function LoginPage() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'conectado'>('idle');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Partículas de fondo animadas via CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ix-float { 0%,100%{transform:translateY(0) rotate(0deg);opacity:.4} 50%{transform:translateY(-20px) rotate(180deg);opacity:.8} }
      @keyframes ix-pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.7;transform:scale(1.05)} }
      @keyframes ix-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes ix-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
      @keyframes ix-fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes ix-connected { 0%{opacity:0;transform:scale(0.8)} 50%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
      @keyframes ix-nodeGlow { 0%,100%{opacity:1} 50%{opacity:.3} }
      @keyframes ix-route { 0%{stroke-dashoffset:200;opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{stroke-dashoffset:0;opacity:0} }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !clave) { setError('Ingresa usuario y clave'); triggerShake(); return; }
    setEstado('cargando');
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, clave }),
    });

    if (res.ok) {
      setEstado('conectado');
      playConnectionSound();
      setTimeout(() => { window.location.href = '/'; }, 2200);
    } else {
      setEstado('idle');
      setError('Usuario o clave incorrectos');
      triggerShake();
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#07091180',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(91,163,224,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(58,170,110,0.05) 0%, transparent 50%), #070b12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: 24, position: 'relative', overflow: 'hidden',
    }}>

      {/* Partículas de fondo */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: [3,2,4,2,3,2][i], height: [3,2,4,2,3,2][i],
          borderRadius: '50%',
          background: i % 2 === 0 ? '#5ba3e0' : '#3aaa6e',
          opacity: 0.3,
          left: `${[15,70,40,85,25,60][i]}%`,
          top:  `${[20,15,70,50,80,35][i]}%`,
          animation: `ix-float ${[6,8,7,9,6.5,8.5][i]}s ${[0,1,2,0.5,1.5,3][i]}s ease-in-out infinite`,
        }}/>
      ))}

      {/* Grid de fondo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(91,163,224,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(91,163,224,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }}/>

      {/* CARD de login */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(13,20,33,0.95)',
        border: '1px solid rgba(91,163,224,0.2)',
        borderRadius: 20,
        padding: '44px 40px',
        boxShadow: '0 0 60px rgba(91,163,224,0.08), 0 24px 80px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        animation: estado === 'conectado' ? 'ix-connected 0.4s ease' : 'ix-fadeIn 0.6s ease',
        transform: shake ? undefined : 'none',
        animationName: shake ? 'ix-shake' : (estado === 'conectado' ? 'ix-connected' : 'ix-fadeIn'),
      }}>

        {/* LOGO */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>

          {/* Globo */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <svg width="90" height="90" viewBox="0 0 200 200" fill="none">
              <defs>
                <radialGradient id="lgb" cx="36%" cy="34%" r="65%">
                  <stop offset="0%" stopColor="#0e2a50"/>
                  <stop offset="100%" stopColor="#060e1e"/>
                </radialGradient>
                <clipPath id="lgc"><circle cx="100" cy="100" r="88"/></clipPath>
                <filter id="lglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(91,163,224,0.12)" strokeWidth="3"/>
              <circle cx="100" cy="100" r="88" fill="url(#lgb)"/>
              <g clipPath="url(#lgc)" stroke="rgba(110,170,223,0.2)" strokeWidth="0.8" fill="none">
                <ellipse cx="100" cy="100" rx="88" ry="22"/>
                <ellipse cx="100" cy="100" rx="88" ry="46"/>
                <ellipse cx="100" cy="100" rx="88" ry="68"/>
                <line x1="100" y1="12" x2="100" y2="188"/>
                <ellipse cx="100" cy="100" rx="44" ry="88"/>
                <ellipse cx="100" cy="100" rx="72" ry="88"/>
              </g>
              <g clipPath="url(#lgc)" stroke="#6eaadf" strokeWidth="1.3" fill="none" strokeOpacity="0.4">
                <path d="M54 88 Q78 40 128 62"/>
                <path d="M88 52 Q108 42 128 62"/>
                <path d="M128 62 Q148 80 144 108"/>
                <path d="M54 88 Q48 116 60 140"/>
                <path d="M36 68 Q44 78 54 88"/>
              </g>
              {/* Partículas viajando */}
              <path d="M54 88 Q78 40 128 62" stroke="#c8e4ff" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ strokeDasharray:'10 230', animation:'ix-route 4s linear infinite' }}/>
              <path d="M128 62 Q148 80 144 108" stroke="#c8e4ff" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ strokeDasharray:'10 130', animation:'ix-route 3.5s 1.5s linear infinite' }}/>
              <path d="M36 68 Q44 78 54 88" stroke="#c8e4ff" strokeWidth="2.5" fill="none" strokeLinecap="round"
                style={{ strokeDasharray:'8 100', animation:'ix-route 2.8s 0.8s linear infinite' }}/>
              <g filter="url(#lglow)">
                <circle cx="54"  cy="88"  r="5.5" fill="#7bbcf0" style={{ animation:'ix-nodeGlow 2.5s ease-in-out infinite' }}/>
                <circle cx="128" cy="62"  r="4.5" fill="#7bbcf0" style={{ animation:'ix-nodeGlow 2.5s .6s ease-in-out infinite' }}/>
                <circle cx="144" cy="108" r="4"   fill="#7bbcf0" style={{ animation:'ix-nodeGlow 2.5s 1.2s ease-in-out infinite' }}/>
                <circle cx="36"  cy="68"  r="3.5" fill="#7bbcf0" style={{ animation:'ix-nodeGlow 2.5s 1.8s ease-in-out infinite' }}/>
                <circle cx="60"  cy="140" r="3.5" fill="#7bbcf0" style={{ animation:'ix-nodeGlow 2.5s .3s ease-in-out infinite' }}/>
              </g>
              <circle cx="54" cy="88" r="12" fill="none" stroke="#7bbcf0" strokeWidth="0.8" strokeOpacity="0.2"
                style={{ animation:'ix-pulse 2s ease-in-out infinite' }}/>
              <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(110,170,223,0.3)" strokeWidth="1"/>
              <ellipse cx="78" cy="68" rx="22" ry="12" fill="rgba(255,255,255,0.04)" transform="rotate(-25,78,68)"/>
            </svg>
          </div>

          {/* Wordmark */}
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: '#e2eaf6', lineHeight: 1 }}>
            Infinite<span style={{ color: '#5ba3e0' }}>X</span>
          </div>
          <div style={{ fontSize: 11, color: '#4a6280', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>
            Sistema de Agentes Logísticos
          </div>
          <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, #5ba3e0, transparent)', marginTop: 16 }}/>
        </div>

        {/* ESTADO CONECTADO */}
        {estado === 'conectado' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 14, animation: 'ix-connected 0.5s ease' }}>✦</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#3aaa6e', letterSpacing: 1 }}>CONEXIÓN ESTABLECIDA</div>
            <div style={{ fontSize: 12, color: '#4a6280', marginTop: 8 }}>Accediendo al sistema...</div>
            <div style={{ marginTop: 20, height: 2, background: '#111827', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg, #5ba3e0, #3aaa6e)', animation: 'ix-spin 1s linear', borderRadius: 4, width: '60%' }}/>
            </div>
          </div>
        ) : (
          /* FORMULARIO */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171',
                textAlign: 'center',
              }}>
                {error}
              </div>
            )}

            {/* Usuario */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder="logistica@sicobenediciones.com"
                autoComplete="username"
                style={{
                  width: '100%', background: '#0d1421',
                  border: '1px solid rgba(91,163,224,0.2)',
                  borderRadius: 10, color: '#e2eaf6',
                  padding: '13px 16px', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(91,163,224,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(91,163,224,0.2)'}
              />
            </div>

            {/* Clave */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#4a6280', letterSpacing: 2, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Clave de Acceso
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarClave ? 'text' : 'password'}
                  value={clave}
                  onChange={e => setClave(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%', background: '#0d1421',
                    border: '1px solid rgba(91,163,224,0.2)',
                    borderRadius: 10, color: '#e2eaf6',
                    padding: '13px 44px 13px 16px', fontSize: 13,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(91,163,224,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(91,163,224,0.2)'}
                />
                <button type="button" onClick={() => setMostrarClave(!mostrarClave)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4a6280', fontSize: 14, padding: 0 }}>
                  {mostrarClave ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={estado === 'cargando'}
              style={{
                marginTop: 8,
                background: estado === 'cargando'
                  ? 'rgba(91,163,224,0.3)'
                  : 'linear-gradient(135deg, #1d4ed8, #5ba3e0)',
                color: '#fff',
                border: 'none', borderRadius: 10,
                padding: '14px', fontSize: 14, fontWeight: 600,
                cursor: estado === 'cargando' ? 'not-allowed' : 'pointer',
                letterSpacing: 1, textTransform: 'uppercase',
                transition: 'all 0.2s',
                boxShadow: estado === 'cargando' ? 'none' : '0 4px 20px rgba(91,163,224,0.3)',
              }}
            >
              {estado === 'cargando' ? '⏳ Verificando...' : '⚡ Conectar al Sistema'}
            </button>

          </form>
        )}

        {/* Footer */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(91,163,224,0.3), transparent)', margin: '0 auto 14px' }}/>
          <div style={{ fontSize: 10, color: '#2d3f55', letterSpacing: 1 }}>
            SICOBEN EDICIONES · KADI INTERNACIONAL S.A.
          </div>
        </div>

      </div>
    </div>
  );
}
