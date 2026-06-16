"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  referencia_id: string | null;
  referencia_tipo: string | null;
};

function getDestino(tipo: string, role: "professor" | "aluno"): string {
  const tiposAgenda = [
    "aula_agendada",
    "pagamento_informado",
    "aula_cancelada_aluno",
    "aula_confirmada",
    "aula_recusada",
    "aula_cancelada_professor",
  ];
  if (tiposAgenda.includes(tipo)) {
    return role === "professor" ? "/professor/agenda" : "/aluno/agenda";
  }
  if (role === "aluno") return "/aluno/meus-treinos";
  return "/professor/alunos";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  return d.toLocaleDateString("pt-BR");
}

export function NotificationBell({
  role,
  panelClass = "right-0 top-10",
}: {
  role: "professor" | "aluno";
  panelClass?: string;
}) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.lida).length;

  const fetchNotifs = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, mensagem, lida, created_at, referencia_id, referencia_tipo")
      .eq("destinatario_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifs(data as Notificacao[]);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchNotifs(user.id);
    });
  }, [fetchNotifs]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => fetchNotifs(userId), 30_000);
    return () => clearInterval(interval);
  }, [userId, fetchNotifs]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handleClickNotif(n: Notificacao) {
    if (!n.lida) {
      await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    setOpen(false);
    router.push(getDestino(n.tipo, role));
  }

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("destinatario_id", userId)
      .eq("lida", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center h-8 w-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notificações"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-[14px] min-w-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${panelClass} z-[300] w-72 sm:w-80 rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-white">Notificações</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
            {notifs.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">Sem notificações</p>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/[0.05] transition-colors flex items-start gap-2.5 ${
                    !n.lida ? "bg-white/[0.025]" : ""
                  }`}
                >
                  {!n.lida && (
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                  )}
                  <div className={!n.lida ? "" : "ml-[14px]"}>
                    <p className="text-xs font-semibold text-white leading-snug">{n.titulo}</p>
                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{n.mensagem}</p>
                    <p className="text-[10px] text-white/25 mt-1">{formatDate(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
