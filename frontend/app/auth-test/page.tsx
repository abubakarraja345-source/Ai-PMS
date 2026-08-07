"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthTestPage() {
  const [status, setStatus] = useState("Testing Supabase...");

  useEffect(() => {
    async function testSupabase() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus(`❌ Supabase error: ${error.message}`);
        return;
      }

      setStatus(
        data.session
          ? "✅ Supabase connected — user is signed in."
          : "✅ Supabase connected — no user is signed in."
      );
    }

    testSupabase();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="rounded-xl border p-8">
        <h1 className="text-2xl font-semibold">Supabase Test</h1>
        <p className="mt-4">{status}</p>
      </div>
    </main>
  );
}