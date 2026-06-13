-- Estas duas funções são legítimas (chamadas no onboarding/login e na importação de
-- exercícios), mas só fazem sentido para usuários autenticados. Mantemos EXECUTE para
-- authenticated e revogamos apenas de anon. As guardas internas (auth.uid(), role)
-- continuam valendo como segunda camada.
revoke execute on function public.link_aluno_to_professor_slug(text) from anon;
revoke execute on function public.importar_exercicio_do_catalogo(uuid) from anon;
