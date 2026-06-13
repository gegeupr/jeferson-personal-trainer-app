-- P6.11a: incluir 'pending' no status das assinaturas de aluno (modelo manual)
alter table public.aluno_assinaturas drop constraint if exists aluno_assinaturas_status_check;
alter table public.aluno_assinaturas
  add constraint aluno_assinaturas_status_check
  check (status in ('active','expired','pending','canceled'));

-- P6.12: habilita pg_cron e agenda expiração diária
create extension if not exists pg_cron;

-- '0 6 * * *' (UTC) = 03:00 no horário de Brasília (UTC-3)
select cron.schedule(
  'expire-aluno-assinaturas',
  '0 6 * * *',
  $$update public.aluno_assinaturas
      set status = 'expired', updated_at = now()
    where status = 'active' and end_at is not null and end_at < now()$$
);
