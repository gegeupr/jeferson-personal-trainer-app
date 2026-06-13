import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Em Next 15 cookies() é assíncrono — por isso a função é async.
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Em Server Components, set pode falhar (só funciona em Route Handler / Middleware).
            // Ok: o Supabase ainda funciona para leitura.
          }
        },
      },
    }
  );
}
