"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

type AdminRow = { user_id: string };
type PayoutRow = {
  id: string;
  provider_id: string;
  user_id: string;
  amount_naira: number;
  bank_name: string;
  account_name: string;
  account_last4: string;
  status: "pending" | "paid" | "rejected";
  is_test: boolean;
  requested_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  paid_reference: string | null;
  providers: { business_name: string; service_category: string; location: string } | null;
};
type BackendResponse = { ok?: boolean; status?: string; error?: string };

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

async function callProviderBackend(session: AuthSession, payload: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!supabaseUrl || !publishableKey) throw new Error("Provider settlement service is not configured.");
  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-provider`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as BackendResponse;
  if (!response.ok) throw new Error(result.error || "Unable to review payout.");
  return result;
}

export default function PayoutAdminPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }
    setSession(currentSession);
    void load(currentSession);
  }, []);

  async function load(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const admins = await restGet<AdminRow[]>(
        `admin_users?user_id=eq.${currentSession.user.id}&select=user_id&limit=1`,
        currentSession.access_token,
      );
      if (!admins[0]) throw new Error("Admin access is required.");
      const rows = await restGet<PayoutRow[]>(
        "payout_requests?select=id,provider_id,user_id,amount_naira,bank_name,account_name,account_last4,status,is_test,requested_at,reviewed_at,admin_note,paid_reference,providers(business_name,service_category,location)&order=requested_at.desc",
        currentSession.access_token,
      );
      setPayouts(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payout requests.");
    } finally {
      setLoading(false);
    }
  }

  async function review(payout: PayoutRow, action: "admin_mark_paid" | "admin_reject") {
    if (!session || payout.status !== "pending") return;
    setWorkingId(payout.id);
    setError("");
    setMessage("");
    try {
      if (action === "admin_mark_paid" && !payout.is_test) {
        const paidReference = (references[payout.id] || "").trim();
        if (paidReference.length < 6) throw new Error("Enter the real bank transfer/reference before confirming this payout as paid.");
        await callProviderBackend(session, { action, payout_id: payout.id, paid_reference: paidReference });
        setMessage("Live provider payout marked paid and recorded in the Rydah ledger.");
      } else if (action === "admin_mark_paid") {
        await callProviderBackend(session, { action, payout_id: payout.id, paid_reference: `TEST-${Date.now()}` });
        setMessage("Test payout marked paid.");
      } else {
        await callProviderBackend(session, { action, payout_id: payout.id });
        setMessage("Payout request rejected.");
      }
      await load(getStoredSession() ?? session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review payout.");
    } finally {
      setWorkingId("");
    }
  }

  const livePayouts = payouts.filter((p) => !p.is_test);
  const pendingTotal = useMemo(() => livePayouts.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount_naira || 0), 0), [payouts]);
  const paidTotal = useMemo(() => livePayouts.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount_naira || 0), 0), [payouts]);
  const pendingCount = livePayouts.filter((p) => p.status === "pending").length;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH ADMIN</p>
            <h1 className="mt-1 text-2xl font-black">Provider Payouts</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/finance" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Finance</a>
            <a href="/admin/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Providers</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-300">
          LIVE PAYOUT LEDGER — only mark a live payout paid after the provider has actually received an external bank transfer. A payment reference is required.
        </div>
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Live pending requests</p><p className="mt-2 text-3xl font-black text-[#D4AF37]">{pendingCount}</p></div>
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Live pending amount</p><p className="mt-2 text-3xl font-black">{naira(pendingTotal)}</p></div>
          <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Live marked paid</p><p className="mt-2 text-3xl font-black text-emerald-400">{naira(paidTotal)}</p></div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">PAYOUT QUEUE</p><h2 className="mt-1 text-3xl font-black">Requests</h2></div>
          {session && <button onClick={() => void load(session)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh</button>}
        </div>

        {loading ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading payout requests...</div>
        ) : payouts.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No payout requests yet.</div>
        ) : (
          <div className="mt-5 grid gap-4">
            {payouts.map((payout) => (
              <article key={payout.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-black">{payout.providers?.business_name || "Provider"}</h3>{payout.is_test && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-300">TEST</span>}{!payout.is_test && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">LIVE</span>}</div>
                    <p className="mt-2 text-zinc-400">{payout.providers?.service_category || "Service"} • {payout.providers?.location || "Location"}</p>
                    <p className="mt-2 text-sm text-zinc-500">Requested {new Date(payout.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right"><p className="text-3xl font-black text-[#D4AF37]">{naira(payout.amount_naira)}</p><span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${payout.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : payout.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>{payout.status.toUpperCase()}</span></div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Bank</p><p className="mt-1 font-bold">{payout.bank_name}</p></div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Account name</p><p className="mt-1 font-bold">{payout.account_name}</p></div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Account</p><p className="mt-1 font-bold">••••{payout.account_last4}</p></div>
                </div>

                {payout.paid_reference && <p className="mt-4 break-all text-sm text-zinc-400">Payout reference: {payout.paid_reference}</p>}
                {payout.admin_note && <p className="mt-2 text-sm text-zinc-400">Admin note: {payout.admin_note}</p>}

                {payout.status === "pending" && (
                  <div className="mt-5">
                    {!payout.is_test && <input value={references[payout.id] || ""} onChange={(e) => setReferences((r) => ({ ...r, [payout.id]: e.target.value }))} placeholder="Bank transfer/reference after funds are sent" className="mb-3 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 outline-none" />}
                    <div className="flex flex-wrap gap-3">
                      <button disabled={workingId === payout.id} onClick={() => void review(payout, "admin_mark_paid")} className="rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black disabled:opacity-50">{workingId === payout.id ? "Processing..." : payout.is_test ? "Mark Test Paid" : "Confirm Bank Transfer Paid"}</button>
                      <button disabled={workingId === payout.id} onClick={() => void review(payout, "admin_reject")} className="rounded-2xl border border-red-500/30 px-5 py-3 font-black text-red-300 disabled:opacity-50">Reject</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
