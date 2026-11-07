-- ============================================================================
-- DULCECONTROL — ESQUEMA DE BASE DE DATOS EN SUPABASE (PostgreSQL)
-- Copia y pega este script en el "SQL Editor" de tu proyecto en Supabase
-- y presiona "Run" para dejar lista la sincronización entre Celular y PC.
-- ============================================================================

create table if not exists public.dulce_control_store (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Habilitar Row Level Security (RLS) con política de lectura/escritura para la app
alter table public.dulce_control_store enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.dulce_control_store to anon, authenticated;

drop policy if exists "Permitir acceso completo a la app DulceControl" on public.dulce_control_store;

create policy "Permitir acceso completo a la app DulceControl"
  on public.dulce_control_store
  for all
  to anon, authenticated
  using (true)
  with check (true);

