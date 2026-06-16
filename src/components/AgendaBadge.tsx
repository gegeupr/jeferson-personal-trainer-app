"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase-browser";

export function AgendaBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count: c } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("professor_id", user.id)
        .eq("status", "pagamento_informado");
      setCount(c ?? 0);
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-auto h-[14px] min-w-[14px] rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center px-0.5 leading-none pointer-events-none">
      {count > 9 ? "9+" : count}
    </span>
  );
}
