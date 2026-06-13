-- 1) Campos de Pix no perfil do professor
alter table public.profiles
  add column if not exists chave_pix text,
  add column if not exists tipo_chave_pix text
    check (tipo_chave_pix in ('cpf','email','telefone','aleatoria'));

-- 2) Policy que faltava: usuário pode atualizar o PRÓPRIO perfil
create policy profiles_update_own
  on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3) Guarda de segurança: ao editar o PRÓPRIO perfil, o usuário NÃO pode
--    escalar o próprio papel (ex.: aluno virar professor pra fugir do pagamento).
--    Mudança de role continua possível via service-role/admin.
create or replace function public.tg_profiles_block_self_role_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role then
    new.role := old.role; -- ignora a tentativa de troca de role
  end if;
  return new;
end;
$$;

create trigger trg_profiles_block_self_role_change
  before update on public.profiles
  for each row execute function public.tg_profiles_block_self_role_change();
