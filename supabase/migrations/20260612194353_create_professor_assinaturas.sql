-- Assinatura do PROFESSOR (Stripe). Uma linha por professor.
create table if not exists public.professor_assinaturas (
  id                    uuid primary key default gen_random_uuid(),
  professor_id          uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id    text,
  stripe_subscription_id text,
  status                text not null default 'trial'
                          check (status in ('trial','active','past_due','canceled')),
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint professor_assinaturas_professor_unique unique (professor_id)
);

-- Lookups do webhook
create index if not exists idx_prof_assin_subscription
  on public.professor_assinaturas (stripe_subscription_id);
create index if not exists idx_prof_assin_customer
  on public.professor_assinaturas (stripe_customer_id);

-- RLS: professor só enxerga a PRÓPRIA linha.
-- Escrita só via service-role (checkout/webhook), que ignora RLS.
-- Não criamos policy de insert/update/delete p/ authenticated/anon.
alter table public.professor_assinaturas enable row level security;

create policy professor_assin_select_own
  on public.professor_assinaturas
  for select to authenticated
  using (professor_id = auth.uid());

-- updated_at automático (search_path fixo p/ não cair no advisor)
create or replace function public.tg_professor_assinaturas_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_professor_assinaturas_updated_at
  before update on public.professor_assinaturas
  for each row execute function public.tg_professor_assinaturas_updated_at();

-- Backfill: professor(es) existente(s) ganham 7 dias de trial para não serem
-- bloqueados quando o middleware (P5.9) entrar.
insert into public.professor_assinaturas (professor_id, status, trial_ends_at)
select p.id, 'trial', now() + interval '7 days'
from public.profiles p
where p.role = 'professor'
on conflict (professor_id) do nothing;
