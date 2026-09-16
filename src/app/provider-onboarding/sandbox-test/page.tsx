"use client";

import { useEffect, useState } from "react";
import { getStoredSession, type AuthSession } from "@/lib/supabase";

type IdentityResponse = {
  ok?: boolean;
  configured?: boolean;
  environment?: string;
  status?: string;
  biometric_status?: string;
  result_text?: string;
  error?: string;
};

async function callIdentityBackend(session: AuthSession, payload: Record<string, unknown>) {
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
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as IdentityResponse;
  return { response, result };
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to prepare the sandbox face image."));
    reader.readAsDataURL(blob);
  });
}

export default function SandboxFaceTestPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [environment, setEnvironment] = useState("");
  const [configured, setConfigured] = useState(false);
  const [nin, setNin] = useState("11111111111");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.assign("/sign-in");
      return;
    }

    setSession(currentSession);
    void (async () => {
      try {
        const { response, result } = await callIdentityBackend(currentSession, { action: "status" });
        if (!response.ok) throw new Error(result.error || "Unable to check Youverify status.");
        setEnvironment(result.environment || "");
        setConfigured(Boolean(result.configured));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to check Youverify status.");
      }
    })();
  }, []);

  async function runSandboxTest() {
    if (!session) return;
    if (!consent) {
      setError("Tick the consent box before running the sandbox test.");
      return;
    }
    if (environment !== "sandbox") {
      setError("This test is available only while Youverify is in sandbox mode.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("Preparing the Youverify sandbox face image…");

    try {
      const imageResponse = await fetch("/api/youverify-sandbox-face", { cache: "no-store" });
      if (!imageResponse.ok) throw new Error("Unable to load the Youverify sandbox face image.");
      const selfie = await blobToDataUrl(await imageResponse.blob());

      setMessage("Sending the sandbox NIN and face to Youverify…");
      const { response, result } = await callIdentityBackend(session, {
        action: "verify_face_id",
        id_number: nin.trim(),
        selfie,
        consent: true,
      });

      if (response.ok) {
        setMessage(`Sandbox Face & ID test completed: ${result.result_text || "verified"}`);
        return;
      }

      if (response.status === 422) {
        setMessage(`Sandbox request reached Youverify and completed with a non-match result: ${result.error || result.result_text || "face did not match"}. This still confirms the connection is working.`);
        return;
      }

      throw new Error(result.error || "Unable to complete the sandbox Face & ID test.");
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to complete the sandbox Face & ID test.");
    } finally {
      setBusy(false);
    }
  }

  const ready = environment === "sandbox" && configured;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <section className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
        <h1 className="mt-2 text-3xl font-black">Youverify Sandbox Test</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          This page bypasses the Android file picker and sends Youverify&apos;s sandbox sample face directly for testing. It is disabled automatically outside sandbox mode.
        </p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`rounded-full px-3 py-2 font-black ${environment === "sandbox" ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "bg-zinc-800 text-zinc-400"}`}>
              {environment ? environment.toUpperCase() : "CHECKING"}
            </span>
            <span className={`rounded-full px-3 py-2 font-black ${configured ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-300"}`}>
              {configured ? "CONNECTED" : "NOT CONNECTED"}
            </span>
          </div>

          <label className="mt-6 block">
            <span className="text-sm font-bold">Sandbox NIN</span>
            <input value={nin} onChange={(e) => setNin(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
          </label>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>I consent to running this sandbox-only Face & ID verification test.</span>
          </label>

          <button
            type="button"
            onClick={runSandboxTest}
            disabled={!ready || !nin.trim() || !consent || busy}
            className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-40"
          >
            {busy ? "Running Sandbox Test…" : "Run Sandbox Face & ID Test"}
          </button>

          {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-300">{message}</div>}
          {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm leading-6 text-red-300">{error}</div>}

          <a href="/provider-onboarding" className="mt-6 inline-block text-sm font-bold text-[#D4AF37]">← Back to Provider Verification</a>
        </div>
      </section>
    </main>
  );
}
