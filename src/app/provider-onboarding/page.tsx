"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  getStoredSession,
  restGet,
  restInsert,
  restPatch,
  type AuthSession,
} from "@/lib/supabase";

type ProviderRow = {
  id: string;
  business_name: string;
  service_category: string;
  location: string;
  is_verified: boolean;
};

type VerificationRow = {
  id: string;
  provider_id: string;
  legal_name: string;
  phone: string;
  years_experience: number;
  service_address: string;
  id_type: "NIN" | "Drivers Licence" | "International Passport" | "Voters Card";
  id_last4: string;
  status: "draft" | "pending" | "approved" | "rejected";
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

const idTypes: VerificationRow["id_type"][] = [
  "NIN",
  "Drivers Licence",
  "International Passport",
  "Voters Card",
];

function statusStyle(status: VerificationRow["status"]) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-400";
  if (status === "rejected") return "bg-red-500/15 text-red-300";
  if (status === "pending") return "bg-[#D4AF37]/15 text-[#D4AF37]";
  return "bg-zinc-800 text-zinc-400";
}

export default function ProviderOnboardingPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [verification, setVerification] = useState<VerificationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [yearsExperience, setYearsExperience] = useState("1");
  const [serviceAddress, setServiceAddress] = useState("");
  const [idType, setIdType] = useState<VerificationRow["id_type"]>("NIN");
  const [idLast4, setIdLast4] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(currentSession);
    void load(currentSession);
  }, []);

  async function load(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const providerRows = await restGet<ProviderRow[]>(
        `providers?user_id=eq.${currentSession.user.id}&select=id,business_name,service_category,location,is_verified&limit=1`,
        currentSession.access_token,
      );
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);

      if (!currentProvider) {
        setVerification(null);
        return;
      }

      const verificationRows = await restGet<VerificationRow[]>(
        `provider_verifications?provider_id=eq.${currentProvider.id}&select=*&limit=1`,
        currentSession.access_token,
      );
      const currentVerification = verificationRows[0] ?? null;
      setVerification(currentVerification);

      if (currentVerification) {
        setLegalName(currentVerification.legal_name);
        setPhone(currentVerification.phone);
        setYearsExperience(String(currentVerification.years_experience));
        setServiceAddress(currentVerification.service_address);
        setIdType(currentVerification.id_type);
        setIdLast4(currentVerification.id_last4);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load verification details.");
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !provider) return;

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      provider_id: provider.id,
      legal_name: legalName.trim(),
      phone: phone.trim(),
      years_experience: Number(yearsExperience),
      service_address: serviceAddress.trim(),
      id_type: idType,
      id_last4: idLast4.trim().toUpperCase(),
      status: "pending" as const,
      submitted_at: new Date().toISOString(),
    };

    try {
      let rows: VerificationRow[];
      if (verification) {
        rows = await restPatch<VerificationRow[]>(
          "provider_verifications",
          `id=eq.${verification.id}`,
          payload,
          session.access_token,
        );
      } else {
        rows = await restInsert<VerificationRow[]>(
          "provider_verifications",
          payload,
          session.access_token,
        );
      }

      const updated = rows[0];
      if (!updated) throw new Error("Verification submission was not returned by the backend.");
      setVerification(updated);
      setMessage("Verification submitted. Rydah will review your provider profile.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit verification.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading verification...</main>;
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Verification</h1>
          </div>
          <a href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Dashboard</a>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {!provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
            <h2 className="text-2xl font-black">Create your provider profile first</h2>
            <p className="mt-3 text-zinc-400">Your business profile must exist before verification can be submitted.</p>
            <a href="/provider-dashboard" className="mt-6 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Go to Provider Dashboard</a>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">Provider</p>
                  <h2 className="mt-1 text-2xl font-black">{provider.business_name}</h2>
                  <p className="mt-1 text-zinc-400">{provider.service_category} • {provider.location}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-xs font-black ${statusStyle(provider.is_verified ? "approved" : verification?.status ?? "draft")}`}>
                  {provider.is_verified ? "✓ VERIFIED" : (verification?.status ?? "draft").toUpperCase()}
                </span>
              </div>
              {verification?.status === "rejected" && verification.admin_notes && (
                <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-200">
                  Review note: {verification.admin_notes}
                </div>
              )}
            </div>

            {provider.is_verified ? (
              <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-7">
                <h3 className="text-2xl font-black text-emerald-400">Provider verified</h3>
                <p className="mt-2 text-zinc-300">Your Rydah verified badge is active in the marketplace.</p>
              </div>
            ) : verification?.status === "pending" ? (
              <div className="mt-6 rounded-3xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-7">
                <h3 className="text-2xl font-black text-[#D4AF37]">Review in progress</h3>
                <p className="mt-2 text-zinc-300">Your details have been submitted. An admin must approve them before the verified badge becomes active.</p>
              </div>
            ) : (
              <form onSubmit={submitVerification} className="mt-6 grid gap-5 rounded-3xl border border-white/10 bg-[#121212] p-7 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">IDENTITY & EXPERIENCE</p>
                  <h3 className="mt-2 text-3xl font-black">Complete verification</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">For this MVP, Rydah stores only the final four characters of the selected ID. Do not enter a complete ID number here.</p>
                </div>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold">Legal name</span>
                  <input required value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="Full legal name" />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Phone</span>
                  <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="080..." />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Years of experience</span>
                  <input required min="0" max="60" type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-bold">Service address / base</span>
                  <input required value={serviceAddress} onChange={(e) => setServiceAddress(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="Business or operating address" />
                </label>

                <label className="block">
                  <span className="text-sm font-bold">ID type</span>
                  <select value={idType} onChange={(e) => setIdType(e.target.value as VerificationRow["id_type"])} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                    {idTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold">Last 4 characters only</span>
                  <input required minLength={4} maxLength={4} pattern="[A-Za-z0-9]{4}" value={idLast4} onChange={(e) => setIdLast4(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 uppercase outline-none" placeholder="1234" />
                </label>

                <button disabled={saving} className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-60">
                  {saving ? "Submitting..." : verification?.status === "rejected" ? "Resubmit Verification" : "Submit for Verification"}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
