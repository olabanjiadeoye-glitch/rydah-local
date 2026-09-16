"use client";

import { useEffect, useState } from "react";
import { getStoredSession, type AuthSession } from "@/lib/supabase";

type StatusResponse = {
  ok?: boolean;
  configured?: boolean;
  environment?: string;
  biometric_status?: string;
  biometric_provider?: string | null;
  biometric_result_text?: string | null;
  biometric_verified_at?: string | null;
  error?: string;
};

async function checkStatus(session: AuthSession) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!supabaseUrl || !publishableKey) throw new Error("Identity verification service is not configured.");

  const response = await fetch(`${supabaseUrl}/functions/v1/identity-verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "status" }),
  });

  const result = (await response.json().catch(() => ({}))) as StatusResponse;
  if (!response.ok) throw new Error(result.error || "Unable to check identity provider status.");
  return result;
}

export default function VerificationStatusPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      window.location.assign("/sign-in");
      return;
    }

    void checkStatus(session)
      .then((value) => setResult(value))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to check status."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-white">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm font-black tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
        <h1 className="mt-2 text-3xl font-black">Face & ID connection status</h1>
        <p className="mt-2 text-sm text-zinc-400">This page checks whether the external identity-verification service is connected. It does not display or expose the secret key.</p>

        <div className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-7">
          {loading ? (
            <p className="text-zinc-400">Checking connection…</p>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-red-300">{error}</div>
          ) : result?.configured ? (
            <>
              <div className="inline-flex rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-400">CONNECTED</div>
              <h2 className="mt-4 text-2xl font-black">Identity provider is connected</h2>
              <p className="mt-2 text-zinc-400">Environment: <span className="font-bold text-white">{result.environment || "unknown"}</span></p>
              <p className="mt-2 text-zinc-400">Current biometric status: <span className="font-bold text-white">{(result.biometric_status || "not_started").replaceAll("_", " ")}</span></p>
              <a href="/provider-onboarding" className="mt-6 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black">Open Face & ID Verification</a>
            </>
          ) : (
            <>
              <div className="inline-flex rounded-full bg-[#D4AF37]/15 px-4 py-2 text-sm font-black text-[#D4AF37]">SETUP REQUIRED</div>
              <h2 className="mt-4 text-2xl font-black">Identity provider is not connected yet</h2>
              <p className="mt-2 text-zinc-400">Add the Youverify secret token in Supabase, then reload this page.</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
