import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  // Rotas públicas
  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/termos") ||
    pathname.startsWith("/privacidade") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/auth/callback")
  ) {
    return true;
  }

  // Next internals e arquivos estáticos
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/public")
  ) {
    return true;
  }

  // API pública (se você tiver)
  // if (pathname.startsWith("/api/public")) return true;

  return false;
}

function needsAluno(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/aluno");
}

function needsProfessor(pathname: string) {
  return pathname.startsWith("/professor");
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Se for público, deixa passar
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Só proteger as áreas que interessam
  const protectedAluno = needsAluno(pathname);
  const protectedProfessor = needsProfessor(pathname);

  if (!protectedAluno && !protectedProfessor) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Supabase client no middleware (Edge)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 1) Check sessão
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2) Buscar role no profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Se não achar role por algum motivo, manda pro login
  if (!role) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // 3) Aplicar regras por role
  if (protectedProfessor && role !== "professor") {
    const target = req.nextUrl.clone();
    target.pathname = "/dashboard";
    return NextResponse.redirect(target);
  }

  if (protectedAluno && role !== "aluno") {
    const target = req.nextUrl.clone();
    target.pathname = "/professor/dashboard";
    return NextResponse.redirect(target);
  }

  return res;
}

// Rodar middleware só onde interessa (evita custo e bugs)
export const config = {
  matcher: ["/dashboard", "/aluno/:path*", "/professor/:path*"],
};
