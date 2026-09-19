"use client";

import { useEffect } from "react";
import { clearSession } from "@/lib/supabase";

export default function SignOutPage() {
  useEffect(() => {
    clearSession();
    window.location.replace("/sign-in");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080808] px-5 text-white">
      <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
        <h1 className="mt-3 text-2xl font-black">Signing you out...</h1>
      </div>
    </main>
  );
}
