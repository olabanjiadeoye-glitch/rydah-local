"use client";

import { FormEvent, useEffect, useState } from "react";
import { getStoredSession, restGet, type AuthSession, invokeFunction } from "@/lib/supabase";

type Verification = {
  id_type: "NIN" | "Drivers Licence" | "International Passport" | "Voters Card";
  id_last4: string;
};

type Provider = {
  id: string;
  business_name: string;
};

type ChangeResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

export default function ChangeProviderIdPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [idType, setIdType] = useState<"NIN" | "International Passport">("NIN");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(current);
    void load(current);
  }, []);

  async function load(current: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const providers = await restGet<Provider[]>(
        `providers?user_id=eq.${current.user.id}&select=id,business_name&limit=1`,
        current.access_token,
      );
      const currentProvider = providers[0] ?? null;
      setProvider(currentProvider);
      if (!currentProvider) return;

      const rows = await restGet<Verification[]>(
        `provider_verifications?provider_id=eq.${currentProvider.id}&select=id_type,id_last4&limit=1`,
        current.access_token,
      );
      const currentVerification = rows[0] ?? null;
      setVerification(currentVerification);
      if (currentVerification?.id_type === "International Passport") setIdType("International Passport");
      else setIdType("NIN");
      setLast4(currentVerification?.id_last4 || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load verification details.");
    } finally {
      setLoading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const cleanLast4 = last4.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(cleanLast4)) {
      setError("Enter exactly the last 4 characters of the selected ID.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await invokeFunction(
        "change-provider-id-type",
        { id_type: idType, id_last4: cleanLast4 },
        session.access_token,
      );
      const result = (await response.json().catch(() => ({}))) as ChangeResponse;
      if (!response.ok) throw new Error(result.error || "Unable to change verification ID type.");

      setMessage(result.message || "Verification ID type updated.");
      setTimeout(() => window.location.assign("/provider-onboarding"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change verification ID type.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Change Face & ID Method</h1>
          </div>
          <a href="/provider-onboarding" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Back</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-6 sm:py-8">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading verification details…</div>
        ) : !provider || !verification ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-5 sm:p-6 text-red-200">Provider verification record not found.</div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">
              <p className="text-sm text-zinc-500">Provider</p>
              <h2 className="mt-1 text-2xl font-black">{provider.business_name}</h2>
              <p className="mt-3 text-sm text-zinc-400">Current ID type: <span className="font-bold text-white">{verification.id_type}</span></p>
            </div>

            {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <form onSubmit={save} className="mt-6 grid gap-5 rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-5 sm:p-6">
              <div>
                <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">FACE & ID MATCH</p>
                <h3 className="mt-2 text-3xl font-black">Choose a supported ID</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Automated face matching currently supports NIN and International Passport. Changing this resets only the biometric Face & ID attempt; it does not remove the provider profile.</p>
              </div>

              <label className="block">
                <span className="text-sm font-bold">ID type</span>
                <select value={idType} onChange={(event) => setIdType(event.target.value as "NIN" | "International Passport")} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                  <option value="NIN">NIN</option>
                  <option value="International Passport">International Passport</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-bold">Last 4 characters only</span>
                <input required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" value={last4} onChange={(event) => setLast4(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 uppercase outline-none" placeholder="1234" />
                <span className="mt-2 block text-xs text-zinc-500">For a real verification, enter the last four characters of the provider’s genuine ID.</span>
              </label>

              <button disabled={saving} className="rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">
                {saving ? "Updating…" : "Use This ID For Face Match"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}