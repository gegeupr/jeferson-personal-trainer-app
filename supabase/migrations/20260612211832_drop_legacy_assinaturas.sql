-- Remove a tabela de assinaturas legada (fluxo Stripe do aluno), agora substituída
-- pelo modelo manual em public.aluno_assinaturas. Confirmado: 0 linhas, sem views
-- dependentes e sem referências no código (todas as páginas foram repontadas).
drop table if exists public.assinaturas cascade;
