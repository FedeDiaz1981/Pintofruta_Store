create table if not exists public.excel_sync_tokens (
  id text primary key,
  label text not null,
  token_hash text not null unique,
  scopes jsonb not null default '["catalog:read","catalog:write"]'::jsonb,
  active boolean not null default true,
  expires_at timestamptz,
  created_by integer references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_used_ip text
);

create index if not exists excel_sync_tokens_active_idx on public.excel_sync_tokens (active);
create index if not exists excel_sync_tokens_expires_idx on public.excel_sync_tokens (expires_at);
