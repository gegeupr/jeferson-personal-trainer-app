-- Cria a linha de assinatura em trial (7 dias) sempre que um perfil vira professor,
-- seja no registro (insert) ou numa eventual mudança de role (aluno -> professor).
create or replace function public.tg_professor_trial_on_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'professor' then
    insert into public.professor_assinaturas (professor_id, status, trial_ends_at)
    values (new.id, 'trial', now() + interval '7 days')
    on conflict (professor_id) do nothing;
  end if;
  return new;
end;
$$;

-- Função de trigger não deve ser chamável como RPC (evita o alerta do advisor)
revoke execute on function public.tg_professor_trial_on_profile() from public, anon, authenticated;

-- No registro
create trigger trg_professor_trial_on_profile_ins
  after insert on public.profiles
  for each row execute function public.tg_professor_trial_on_profile();

-- Quando um perfil existente passa a ser professor
create trigger trg_professor_trial_on_profile_upd
  after update of role on public.profiles
  for each row
  when (new.role = 'professor' and new.role is distinct from old.role)
  execute function public.tg_professor_trial_on_profile();
