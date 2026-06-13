-- A view estava como SECURITY DEFINER (roda com privilégios do criador, ignorando a RLS
-- de quem consulta). Como profiles já tem policy pública para professores e a view só
-- expõe colunas seguras, trocamos para SECURITY INVOKER (respeita a RLS do chamador).
alter view public.professores_publicos set (security_invoker = true);
