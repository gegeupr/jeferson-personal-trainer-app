-- Adiciona flag para identificar treinos gerados pela IA (Gemini)
alter table public.treinos
  add column if not exists gerado_por_ia boolean not null default false;

-- Índice para filtrar treinos de IA rapidamente
create index if not exists idx_treinos_gerado_por_ia
  on public.treinos (gerado_por_ia)
  where gerado_por_ia = true;
