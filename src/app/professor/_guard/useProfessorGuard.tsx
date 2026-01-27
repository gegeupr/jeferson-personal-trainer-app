"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase-browser";

export function useProfessorGuard() {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);

      const { data: auth, error: authError } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!alive) return;

      if (authError || !user) {
        router.push("/login");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (profErr || !prof) {
        router.push("/login");
        return;
      }

      if ((prof.role || "").toLowerCase() !== "professor") {
        router.push("/dashboard");
        return;
      }

      setOk(true);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  return { ok, loading };
}