-- Agente de Ventas — tabla pedidos_venta (Etapa 3 del plan)
-- Ejecutar en Supabase → SQL Editor (mismo patrón usado para crear "proveedores").
-- No sincroniza país de destino ni observaciones porque Monday no tiene esas columnas —
-- quedan como campos editables solo desde InfiniteX (ver propuesta, sección 2).

create table if not exists public.pedidos_venta (
  id uuid primary key default gen_random_uuid(),
  monday_item_id text unique not null,
  monday_group_id text,
  numero_pedido text,
  nombre_item text,
  cliente text,
  pais_destino text,               -- manual, no viene de Monday
  responsable_comercial text,       -- columna "Estado" de Monday (mal nombrada, ver propuesta)
  valor_pedido numeric,
  estado_monday text,               -- etiqueta original de Monday, sin traducir
  estatus_agente text,              -- calculado por el diccionario del Agente de Ventas
  fecha_solicitud date,             -- "Fecha recepción de pedido"
  fecha_envio_agente date,          -- "Fecha envío a Anker" (aproximación a "entrada en preparación")
  fecha_listo date,                 -- "Fecha pedido listo" / fecha estimada de despacho
  fecha_despacho date,
  observaciones text,               -- manual, no viene de Monday
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pedidos_venta enable row level security;

create policy "allow anon full access" on public.pedidos_venta
  for all using (true) with check (true);
