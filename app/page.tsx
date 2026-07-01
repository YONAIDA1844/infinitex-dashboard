export default function Home() {
  const agentes = [
    { num: 1, nombre: 'Orquestador Central', area: 'Hub / Router', estado: 'pendiente' },
    { num: 2, nombre: 'Agente Bodega', area: 'Logistica - Bodega Anker', estado: 'pendiente' },
    { num: 3, nombre: 'Agente Ventas', area: 'Logistica - Ventas', estado: 'pendiente' },
    { num: 4, nombre: 'Agente Despacho', area: 'Logistica - Despacho', estado: 'pendiente' },
    { num: 5, nombre: 'Agente Clientes', area: 'Logistica - Clientes', estado: 'pendiente' },
    { num: 6, nombre: 'Agente Trafico', area: 'Logistica - Produccion', estado: 'desarrollo' },
    { num: 7, nombre: 'Agente Administracion', area: 'Logistica - Admin', estado: 'pendiente' },
  ];

  const estadoConfig: Record<string, { label: string; color: string; bg: string }> = {
    desarrollo: { label: 'En Desarrollo', color: '#58a6ff', bg: 'rgba(88,166,255,0.1)' },
    pendiente:  { label: 'Pendiente',     color: '#8b949e', bg: 'rgba(139,148,158,0.08)' },
    activo:     { label: 'Operativo',     color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
  };

  return (
    <main style={{minHeight: '100vh', backgroundColor: '#0d1117', color: '#e6edf3', fontFamily: "'Segoe UI', system-ui, sans-serif"}}>

      {/* HEADER */}
      <header style={{backgroundColor: '#161b22', borderBottom: '1px solid #21262d', padding: '18px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
          <div style={{letterSpacing: '4px', fontSize: '20px', fontWeight: '700'}}>
            <span style={{color: '#58a6ff'}}>INFINITE</span>
            <span style={{color: '#ffffff'}}> X</span>
          </div>
          <div style={{width: '1px', height: '24px', backgroundColor: '#21262d'}}></div>
          <span style={{color: '#8b949e', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase'}}>Sistema de Agentes Logisticos</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3fb950', display: 'inline-block'}}></span>
          <span style={{color: '#3fb950', fontSize: '12px', letterSpacing: '1px'}}>Sistema Activo</span>
        </div>
      </header>

      {/* HERO */}
      <section style={{padding: '48px 40px 32px'}}>
        <p style={{color: '#8b949e', fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px'}}>Panel de Supervision</p>
        <h1 style={{fontSize: '28px', fontWeight: '600', color: '#e6edf3', marginBottom: '8px'}}>InfiniteX Dashboard</h1>
        <p style={{color: '#8b949e', fontSize: '14px'}}>7 agentes especializados — Sicoben Ediciones Panama</p>
      </section>

      {/* STATS BAR */}
      <section style={{padding: '0 40px 40px', display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
        <div style={{backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '16px 24px', minWidth: '140px'}}>
          <p style={{color: '#8b949e', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px'}}>Total Agentes</p>
          <p style={{color: '#e6edf3', fontSize: '24px', fontWeight: '600'}}>7</p>
        </div>
        <div style={{backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '16px 24px', minWidth: '140px'}}>
          <p style={{color: '#8b949e', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px'}}>En Desarrollo</p>
          <p style={{color: '#58a6ff', fontSize: '24px', fontWeight: '600'}}>1</p>
        </div>
        <div style={{backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '16px 24px', minWidth: '140px'}}>
          <p style={{color: '#8b949e', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px'}}>Pendientes</p>
          <p style={{color: '#8b949e', fontSize: '24px', fontWeight: '600'}}>6</p>
        </div>
        <div style={{backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '16px 24px', minWidth: '140px'}}>
          <p style={{color: '#8b949e', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px'}}>Operativos</p>
          <p style={{color: '#3fb950', fontSize: '24px', fontWeight: '600'}}>0</p>
        </div>
      </section>

      {/* AGENTES GRID */}
      <section style={{padding: '0 40px 48px'}}>
        <p style={{color: '#8b949e', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px', borderBottom: '1px solid #21262d', paddingBottom: '12px'}}>Agentes del Sistema</p>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px'}}>
          {agentes.map((agente) => {
            const cfg = estadoConfig[agente.estado];
            return (
              <div key={agente.num} style={{backgroundColor: '#161b22', border: '1px solid #21262d', borderRadius: '8px', padding: '24px', position: 'relative', borderLeft: agente.estado === 'desarrollo' ? '3px solid #58a6ff' : '3px solid #21262d'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                  <span style={{color: '#8b949e', fontSize: '11px', letterSpacing: '1px'}}>AGENTE #{agente.num}</span>
                  <span style={{backgroundColor: cfg.bg, color: cfg.color, fontSize: '11px', padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px'}}>
                    {cfg.label}
                  </span>
                </div>
                <h3 style={{color: '#e6edf3', fontSize: '16px', fontWeight: '600', marginBottom: '6px'}}>{agente.nombre}</h3>
                <p style={{color: '#8b949e', fontSize: '13px'}}>{agente.area}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{backgroundColor: '#161b22', borderTop: '1px solid #21262d', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <span style={{color: '#8b949e', fontSize: '12px', letterSpacing: '1px'}}>INFINITE X — Sicoben Ediciones Panama</span>
        <span style={{color: '#8b949e', fontSize: '12px'}}>KADI INTERNATIONAL S.A. © 2026</span>
      </footer>

    </main>
  );
}
