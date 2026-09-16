"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";

type VerificationRow = {
  id: string;
  provider_id: string;
  legal_name: string;
  phone: string;
  years_experience: number;
  service_address: string;
  id_type: string;
  id_last4: string;
  status: "draft" | "pending" | "approved" | "rejected";
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  biometric_status: "not_started" | "pending" | "verified" | "failed" | "review_required";
  biometric_provider: string | null;
  biometric_result_text: string | null;
  biometric_verified_at: string | null;
};

type ProviderRow = {
  id: string;
  business_name: string;
  service_category: string;
  location: string;
  is_verified: boolean;
};

function biometricBadge(status: VerificationRow["biometric_status"]) {
  if (status === "verified") return "bg-emerald-500/15 text-emerald-400";
  if (status === "failed") return "bg-red-500/15 text-red-300";
  if (status === "pending" || status === "review_required") return "bg-[#D4AF37]/15 text-[#D4AF37]";
  return "bg-zinc-800 text-zinc-400";
}

export default function ProviderAdminPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

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
      const adminRows = await restGet<{ user_id: string }[]>(
        `admin_users?user_id=eq.${currentSession.user.id}&select=user_id&limit=1`,
        currentSession.access_token,
      );
      if (!adminRows.length) {
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
      const [verificationRows, providerRows] = await Promise.all([
        restGet<VerificationRow[]>(
          "provider_verifications?select=*&order=created_at.desc",
          currentSession.access_token,
        ),
        restGet<ProviderRow[]>(
          "providers?select=id,business_name,service_category,location,is_verified&order=created_at.desc",
          currentSession.access_token,
        ),
      ]);
      setVerifications(verificationRows);
      setProviders(providerRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load admin verification queue.");
    } finally {
      setLoading(false);
    }
  }

  async function review(row: VerificationRow, status: "approved" | "rejected") {
    if (!session) return;

    if (status === "approved" && row.biometric_status !== "verified") {
      setError("Face & ID Match must be VERIFIED before a new provider can be approved.");
      setMessage("");
      return;
    }

    let adminNotes = status === "approved" ? "Approved by Rydah admin after Face & ID Match." : "Verification rejected by Rydah admin.";
    if (status === "rejected") {
      const reason = window.prompt("Reason for rejection (shown to the provider):", adminNotes);
      if (reason === null) return;
      adminNotes = reason.trim() || adminNotes;
    }

    setSavingId(row.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<VerificationRow[]>(
        "provider_verifications",
        `id=eq.${row.id}`,
        { status, admin_notes: adminNotes },
        session.access_token,
      );
      if (!updated[0]) throw new Error("Verification update was not returned by the backend.");
      setVerifications((current) => current.map((item) => item.id === row.id ? updated[0] : item));
      setProviders((current) => current.map((provider) => provider.id === row.provider_id ? { ...provider, is_verified: status === "approved" } : provider));
      setMessage(status === "approved" ? "Provider approved and verified badge activated." : "Provider verification rejected.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review provider verification.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading admin verification queue...</main>;
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL ADMIN</p>
            <h1 className="mt-1 text-2xl font-black">Provider Verification</h1>
          </div>
          <a href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Marketplace</a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {!isAdmin ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-7">
            <h2 className="text-2xl font-black">Admin access required</h2>
            <p className="mt-3 text-red-200">This account is not authorised to review providers.</p>
          </div>
        ) : (
          <>
            <div className="mb-7 grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><p className="text-sm text-zinc-500">Submissions</p><p className="mt-2 text-3xl font-black">{verifications.length}</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><p className="text-sm text-zinc-500">Pending</p><p className="mt-2 text-3xl font-black text-[#D4AF37]">{verifications.filter((row) => row.status === "pending").length}</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><p className="text-sm text-zinc-500">Face verified</p><p className="mt-2 text-3xl font-black text-emerald-400">{verifications.filter((row) => row.biometric_status === "verified").length}</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#121212] p-5"><p className="text-sm text-zinc-500">Approved</p><p className="mt-2 text-3xl font-black text-emerald-400">{verifications.filter((row) => row.status === "approved").length}</p></div>
            </div>

            {verifications.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No verification submissions yet.</div>
            ) : (
              <div className="grid gap-5">
                {verifications.map((row) => {
                  const provider = providerMap.get(row.provider_id);
                  return (
                    <article key={row.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">{row.status.toUpperCase()}</p>
                          <h2 className="mt-1 text-2xl font-black">{provider?.business_name ?? "Provider"}</h2>
                          <p className="mt-1 text-zinc-400">{provider?.service_category} • {provider?.location}</p>
                        </div>
                        <div className="text-right text-sm text-zinc-500">
                          <p>{row.submitted_at ? `Submitted ${new Date(row.submitted_at).toLocaleString()}` : "Not submitted"}</p>
                          <p className="mt-1">Badge: {provider?.is_verified ? "Verified" : "Not verified"}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Legal name</p><p className="mt-1 font-bold">{row.legal_name}</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Phone</p><p className="mt-1 font-bold">{row.phone}</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Experience</p><p className="mt-1 font-bold">{row.years_experience} year(s)</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4 sm:col-span-2"><p className="text-xs text-zinc-500">Service address</p><p className="mt-1 font-bold">{row.service_address}</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">ID check</p><p className="mt-1 font-bold">{row.id_type} ••••{row.id_last4}</p></div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-zinc-500">Face & ID Match</p>
                            <p className="mt-1 text-sm font-bold">{row.biometric_provider ? `Provider: ${row.biometric_provider}` : "Not run yet"}</p>
                          </div>
                          <span className={`rounded-full px-3 py-2 text-xs font-black ${biometricBadge(row.biometric_status || "not_started")}`}>
                            {(row.biometric_status || "not_started").replaceAll("_", " ").toUpperCase()}
                          </span>
                        </div>
                        {row.biometric_result_text && <p className="mt-3 text-sm text-zinc-300">{row.biometric_result_text}</p>}
                        {row.biometric_verified_at && <p className="mt-2 text-xs text-zinc-500">Verified {new Date(row.biometric_verified_at).toLocaleString()}</p>}
                      </div>

                      {row.admin_notes && <div className="mt-4 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300">Admin note: {row.admin_notes}</div>}

                      {row.status === "pending" && (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button disabled={savingId === row.id || row.biometric_status !== "verified"} onClick={() => void review(row, "approved")} className="rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-35">Approve Provider</button>
                          <button disabled={savingId === row.id} onClick={() => void review(row, "rejected")} className="rounded-2xl border border-red-500/30 px-5 py-3 font-black text-red-300 disabled:opacity-50">Reject</button>
                          {row.biometric_status !== "verified" && <p className="w-full text-xs text-zinc-500">Approval is locked until Face & ID Match is verified.</p>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
