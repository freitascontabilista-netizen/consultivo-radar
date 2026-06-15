-- Tabela de log de atividades do sistema
create table if not exists public.activity_logs (
  id           uuid        primary key default gen_random_uuid(),
  usuario_id   uuid        references auth.users(id) on delete set null,
  usuario_nome text        not null,
  acao         text        not null,
  entidade     text,
  entidade_id  text,
  created_at   timestamptz not null default now()
);

-- Índices para as consultas feitas em Admin.tsx
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_usuario_id_idx  on public.activity_logs (usuario_id);

-- RLS: habilitar mas manter acesso para usuários autenticados
alter table public.activity_logs enable row level security;

-- Qualquer usuário autenticado pode inserir logs
create policy "Usuários autenticados podem inserir logs"
  on public.activity_logs
  for insert
  to authenticated
  with check (true);

-- Qualquer usuário autenticado pode ler logs (a filtragem é feita na query)
create policy "Usuários autenticados podem ler logs"
  on public.activity_logs
  for select
  to authenticated
  using (true);
