// O projeto Supabase tem um teto de linhas por requisição configurado no
// PostgREST (visto empiricamente: Content-Range 0-999/2754 mesmo pedindo
// .limit(5000) explícito) — não é algo que dá pra contornar com .limit()
// no client, nem é um GUC de role (checado via pg_roles.rolconfig, não
// está lá — é config de plataforma). Paginar com .range() em lotes
// contorna isso de vez, não importa o teto do servidor.
//
// Usado por qualquer fetch de tabela que pode passar de ~1000 linhas
// (exercicios_catalogo tem 2754). Ver memória "feedback_supabase_row_limit".

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const todas: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: todas, error };
    if (!data || data.length === 0) break;

    todas.push(...data);
    if (data.length < pageSize) break; // última página
    from += pageSize;
  }

  return { data: todas, error: null };
}
