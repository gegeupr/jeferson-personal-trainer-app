import { NotificationBell } from "@/components/NotificationBell";

export default function AlunoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed bottom-6 right-4 z-50 rounded-xl border border-white/10 bg-[#111]/90 backdrop-blur-sm shadow-xl p-1">
        <NotificationBell role="aluno" panelClass="right-0 bottom-10" />
      </div>
    </>
  );
}
