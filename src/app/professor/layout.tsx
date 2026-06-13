"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

const NAV = [
  { href: "/professor/dashboard",    label: "Dashboard",  icon: <IconHome /> },
  { href: "/professor/alunos",       label: "Alunos",     icon: <IconUsers /> },
  { href: "/professor/treinos",      label: "Treinos",    icon: <IconActivity /> },
  { href: "/professor/biblioteca",   label: "Biblioteca", icon: <IconBook /> },
  { href: "/professor/configuracoes",label: "Config.",    icon: <IconSettings /> },
];

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function active(href: string) {
    if (href === "/professor/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] lg:flex lg:h-screen lg:overflow-hidden">
      {/* ── Sidebar (lg+) ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-white/[0.06]">
        {/* Logo */}
        <div className="flex items-center px-5 py-[18px] border-b border-white/[0.06]">
          <Link href="/professor/dashboard" className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shrink-0">
              <span className="font-black text-black text-[17px] leading-none select-none">M</span>
            </span>
            <span className="font-semibold text-white text-[14px] tracking-[-0.01em]">Motion</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-px" aria-label="Navegação principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                active(item.href)
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom link */}
        <div className="px-3 py-3 border-t border-white/[0.06]">
          <Link
            href="/professor/perfil-publico"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            <IconExternalLink />
            Perfil público
          </Link>
        </div>
      </aside>

      {/* ── Content column ────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 lg:overflow-y-auto">
        {/* Mobile sticky header */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center h-14 px-4 border-b border-white/[0.06] bg-[#0a0a0a]">
          <Link href="/professor/dashboard" className="inline-flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white shrink-0">
              <span className="font-black text-black text-[15px] leading-none select-none">M</span>
            </span>
            <span className="font-semibold text-white text-sm tracking-[-0.01em]">Motion</span>
          </Link>
        </header>

        {/* Page content — extra bottom padding on mobile for fixed nav */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav (fixed) ─────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-md"
        aria-label="Navegação principal"
      >
        <div className="flex items-center justify-around px-1 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${
                active(item.href) ? "text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              {item.icon}
              <span className="text-[9.5px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
