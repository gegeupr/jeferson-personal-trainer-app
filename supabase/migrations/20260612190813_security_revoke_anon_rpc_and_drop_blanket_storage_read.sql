-- Fecha vazamento: get_all_aluno_profiles retorna todos os alunos+emails sem checagem
-- e não é usada pelo app. Revoga execução via PostgREST para todos os papéis.
revoke execute on function public.get_all_aluno_profiles() from public, anon, authenticated;

-- Funções de trigger não devem ser chamáveis como RPC. Triggers continuam funcionando
-- normalmente (não dependem de GRANT EXECUTE para o papel que dispara o statement).
revoke execute on function public.advance_next_rotina() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_professor_id() from public, anon, authenticated;
revoke execute on function public.sync_feedback_to_community_posts() from public, anon, authenticated;

-- Remove a policy "Public read access" (qual = true) que liberava SELECT em TODOS os
-- buckets (inclusive arquivos e progressphotos) para qualquer cliente.
drop policy if exists "Public read access 1h7cfla_0" on storage.objects;
