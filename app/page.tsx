export default function Home() {
  return (
    <main style={{minHeight: '100vh', backgroundColor: '#0f2418', color: 'white', fontFamily: 'sans-serif'}}>

      <header style={{backgroundColor: '#14532d', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div style={{width: '40px', height: '40px', backgroundColor: '#22c55e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: '#14532d'}}>IX</div>
          <div>
            <div style={{fontWeight: 'bold', fontSize: '18px', color: '#22c55e'}}>InfiniteX</div>
            <div style={{fontSize: '12px', color: '#86efac'}}>Sicoben Ediciones</div>
          </div>
        </div>
        <div style={{fontSize: '14px', color: '#86efac'}}>Agente de Trafico</div>
      </header>

      <section style={{textAlign: 'center', padding: '60px 32px'}}>
        <h1 style={{fontSize: '36px', fontWeight: 'bold', color: '#22c55e', marginBottom: '16px'}}>
          Agente de Trafico InfiniteX
        </h1>
        <p style={{fontSize: '18px', color: '#86efac', maxWidth: '600px', margin: '0 auto 32px'}}>
          Sistema de notificaciones automaticas para el equipo de produccion de Sicoben Ediciones Panama
        </p>
        <div style={{display: 'inline-block', backgroundColor: '#22c55e', color: '#14532d', padding: '12px 28px', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px'}}>
          Panel de Control
        </div>
      </section>

      <section style={{display: 'flex', gap: '24px', padding: '0 32px 60px', flexWrap: 'wrap', justifyContent: 'center'}}>
        <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', width: '280px', border: '1px solid #22c55e'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>📦</div>
          <h3 style={{color: '#22c55e', marginBottom: '8px', fontSize: '18px'}}>Proveedores Odoo</h3>
          <p style={{color: '#86efac', fontSize: '14px', lineHeight: '1.6'}}>Monitoreo de ordenes de compra, facturas y entregas pendientes desde Odoo.</p>
        </div>

        <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', width: '280px', border: '1px solid #22c55e'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>🤖</div>
          <h3 style={{color: '#22c55e', marginBottom: '8px', fontSize: '18px'}}>Agente Notificador</h3>
          <p style={{color: '#86efac', fontSize: '14px', lineHeight: '1.6'}}>Automatizacion de alertas via WhatsApp y Email para el equipo de produccion.</p>
        </div>

        <div style={{backgroundColor: '#14532d', borderRadius: '12px', padding: '28px', width: '280px', border: '1px solid #22c55e'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>🔔</div>
          <h3 style={{color: '#22c55e', marginBottom: '8px', fontSize: '18px'}}>Notificaciones</h3>
          <p style={{color: '#86efac', fontSize: '14px', lineHeight: '1.6'}}>Historial de alertas enviadas y seguimiento de entregas criticas.</p>
        </div>
      </section>

      <footer style={{backgroundColor: '#14532d', padding: '20px 32px', textAlign: 'center', color: '#86efac', fontSize: '13px'}}>
        InfiniteX 2026 - Sicoben Ediciones Panama - KADI INTERNATIONAL S.A.
      </footer>

    </main>
  );
}
