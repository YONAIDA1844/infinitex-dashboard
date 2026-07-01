export default function Home() {
    return (
          <main className="min-h-screen" style={{backgroundColor: '#1a3c2e', color: 'white', fontFamily: 'sans-serif'}}>

            {/* HEADER */}
                  <header style={{backgroundColor: '#14532d', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #22c55e'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                        <div style={{width: '40px', height: '40px', backgroundColor: '#22c55e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: '#14532d'}}>IX</div>div>
                                        <div>
                                                    <div style={{fontWeight: 'bold', fontSize: '18px', color: 'white'}}>InfiniteX</div>div>
                                                    <div style={{fontSize: '11px', color: '#86efac'}}>Sicoben Ediciones</div>div>
                                        </div>div>
                            </div>div>
                          <nav style={{display: 'flex', gap: '24px', alignItems: 'center'}}>
                                    <a href="/" style={{color: '#86efac', textDecoration: 'none', fontSize: '14px'}}>Inicio</a>a>
                                    <a href="/proveedores" style={{color: '#86efac', textDecoration: 'none', fontSize: '14px'}}>Proveedores</a>a>
                                    <a href="/agente" style={{color: '#86efac', textDecoration: 'none', fontSize: '14px'}}>Agente</a>a>
                                    <a href="/notificaciones" style={{color: '#86efac', textDecoration: 'none', fontSize: '14px'}}>Notificaciones</a>a>
                                    <a href="/sign-in" style={{backgroundColor: '#22c55e', color: '#14532d', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px'}}>Iniciar Sesión</a>a>
                          </nav>nav>
                  </header>header>
          
            {/* HERO */}
                <section style={{textAlign: 'center', padding: '80px 32px 60px'}}>
                        <div style={{display: 'inline-block', backgroundColor: '#166534', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', color: '#86efac', marginBottom: '24px'}}>Agente de Tráfico Activo</div>div>
                        <h1 style={{fontSize: '48px', fontWeight: 'bold', marginBottom: '16px', lineHeight: '1.2'}}>
                                  Agente de Tráfico <span style={{color: '#22c55e'}}>InfiniteX</span>span>
                        </h1>h1>
                        <p style={{fontSize: '18px', color: '#86efac', maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6'}}>
                                  Plataforma de gestión y notificaciones para el equipo de producción de Sicoben Ediciones.
                                  Conectado con Odoo, WhatsApp y Email.
                        </p>p>
                        <div style={{display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap'}}>
                                  <a href="/sign-in" style={{backgroundColor: '#22c55e', color: '#14532d', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px'}}>Acceder al Sistema</a>a>
                                  <a href="/agente" style={{backgroundColor: 'transparent', color: '#22c55e', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '16px', border: '2px solid #22c55e'}}>Ver Estado del Agente</a>a>
                        </div>div>
                </section>section>
          
            {/* TARJETAS */}
                <section style={{padding: '0 32px 80px', maxWidth: '1100px', margin: '0 auto'}}>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px'}}>
                        
                                  <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', border: '1px solid #166534'}}>
                                              <div style={{fontSize: '32px', marginBottom: '12px'}}>📦</div>div>
                                              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: 'white'}}>Proveedores</h3>h3>
                                              <p style={{fontSize: '14px', color: '#86efac', lineHeight: '1.6'}}>Consulta el catálogo de proveedores en tiempo real desde Odoo. Solo lectura.</p>p>
                                  </div>div>
                        
                                  <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', border: '1px solid #166534'}}>
                                              <div style={{fontSize: '32px', marginBottom: '12px'}}>🤖</div>div>
                                              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: 'white'}}>Agente Activo</h3>h3>
                                              <p style={{fontSize: '14px', color: '#86efac', lineHeight: '1.6'}}>Monitorea el estado del agente notificador y verifica que esté funcionando.</p>p>
                                  </div>div>
                        
                                  <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', border: '1px solid #166534'}}>
                                              <div style={{fontSize: '32px', marginBottom: '12px'}}>🔔</div>div>
                                              <h3 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: 'white'}}>Notificaciones</h3>h3>
                                              <p style={{fontSize: '14px', color: '#86efac', lineHeight: '1.6'}}>Envía alertas al equipo de producción por WhatsApp y Email desde un solo lugar.</p>p>
                                  </div>div>
                        
                        </div>div>
                </section>section>
          
            {/* FOOTER */}
                <footer style={{borderTop: '1px solid #166534', padding: '24px 32px', textAlign: 'center', color: '#4ade80', fontSize: '13px'}}>
                        InfiniteX &copy; 2026 &mdash; Sicoben Ediciones &bull; Panama
                </footer>footer>
          
          </main>main>
        );
}
</div>
