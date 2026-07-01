# InfiniteX — Sistema de Agentes de Supervisión Logística
## Product Requirements Document (PRD)

Versión: 2.2
Fecha: Julio 2026
Estado: Draft

> InfiniteX es una red de inteligencia operativa compuesta por 7 agentes especializados, orquestados por un hub central, que supervisan y comunican en tiempo real todas las operaciones de logística, importaciones y administración.

---

## DISEÑO VISUAL (IMPORTANTE - LEER ANTES DE MODIFICAR CÓDIGO)

### Colores Oficiales
- Fondo principal: #0d1117 (azul marino muy oscuro)
- Fondo cards: #161b22 (azul marino oscuro)
- Bordes: #21262d (gris azulado)
- Texto principal: #e6edf3 (blanco suave)
- Texto secundario: #8b949e (gris)
- Acento principal: #58a6ff (azul celeste brillante)
- Acento verde (operativo): #3fb950
- Acento amarillo (pendiente): #d29922
- Acento rojo (error): #f85149

### Logo
- Texto: "INFINITE X" en mayúsculas con espaciado amplio
- "INFINITE" en color #58a6ff (celeste)
- "X" en color #ffffff (blanco)
- Subtítulo del agente activo en gris claro, espaciado amplio

### Tipografía
- Sistema sans-serif tecnológico, letras espaciadas (letter-spacing)
- Títulos de sección en MAYÚSCULAS con tracking amplio
- Estilo oscuro profesional, NO verde

---

## Los 7 Agentes de InfiniteX

| # | Nombre | Área | Estado |
|---|--------|------|--------|
| 1 | Orquestador Central | Hub Router | Pendiente |
| 2 | Agente Bodega | Logística - Bodega Anker | Pendiente |
| 3 | Agente Ventas | Logística - Ventas | Pendiente |
| 4 | Agente Despacho | Logística - Despacho | Pendiente |
| 5 | Agente Clientes | Logística - Clientes | Pendiente |
| 6 | Agente Tráfico | Logística - Producción | En Desarrollo |
| 7 | Agente Administración | Logística - Admin | Pendiente |

---

## Equipo de Producción (Agente Tráfico)

Destinatarios en test.equipo WHERE grupo = 'produccion' AND activo = true:
- Daniel Benarroch — daniel.benarroch@sicobenediciones.com
- Asistente Dirección — asistente.direccion@sicobenediciones.com
- Asistente Ventas — asistente.ventas@sicobenediciones.com

---

## Integraciones

| Integración | Estado |
|-------------|--------|
| Odoo | Configurado (secrets activos) |
| Gmail SMTP | Pendiente implementación |
| WhatsApp Meta | Verificación en proceso (KADI INTERNATIONAL SA) |

---

## Stack Tecnológico

- Frontend: Next.js en Vercel
- URL: https://infinitex-dashboard.vercel.app
- Backend: Supabase Edge Functions
- Edge Function: agente-notificador (activa)
- Base de datos: Supabase schema test (11 tablas)
- Repo GitHub: YONAIDA1844/infinitex-dashboard

---

## Estado del Proyecto (Julio 2026)

- Dashboard InfiniteX desplegado en Vercel (1-Jul-2026)
- Edge Function agente-notificador activa
- Odoo conectado (read-only)
- Gmail SMTP pendiente
- WhatsApp Meta en verificación

---

## Sesiones de Desarrollo

| Fecha | Avance |
|-------|--------|
| 1-Jul | Dashboard live en Vercel, diseño corregido |
| 30-Jun | Edge Function + Odoo secrets |
| 30-Jun | Cambio: proveedores van en Odoo (no Monday) |
| 30-Jun | Verificación Meta Business iniciada |
| 23-Jun | Configuración WhatsApp Meta Cloud API |
