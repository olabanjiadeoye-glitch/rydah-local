"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";

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
  providers: {
    business_name: string;
    service_category: string;
    location: string;
  } | null;
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function AdminPayoutsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
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

  async function review(payout: PayoutRow, status: "paid" | "rejected") {
    if (!session || payout.status !== "pending") return;

    setWorkingId(payout.id);
    setError("");
    setMessage("");
    try {
      await restPatch<PayoutRow[]>(
        "payout_requests",
        `id=eq.${payout.id}&status=eq.pending`,
        {
          status,
          admin_note: status === "paid" ? "Sandbox payout approved by Rydah admin." : "Sandbox payout rejected by Rydah admin.",
          updated_at: new Date().toISOString(),
        },
        session.access_token,
      );
      setMessage(status === "paid" ? "Sandbox payout marked paid. No real bank transfer was sent." : "Payout request rejected.");
      await load(getStoredSession() ?? session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to review payout.");
    } finally {
      setWorkingId("");
    }
  }

  const pendingTotal = useMemo(
    () => payouts.filter((payout) => payout.status === "pending").reduce((sum, payout) => sum + Number(payout.amount_naira || 0), 0),
    [payouts],
  );
  const paidTotal = useMemo(
    () => payouts.filter((payout) => payout.status === "paid").reduce((sum, payout) => sum + Number(payout.amount_naira || 0), 0),
    [payouts],
  );
  const pendingCount = payouts.filter((payout) => payout.status === "pending").length;

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
        <div className="mb-6 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
          TEST MODE — marking a payout paid only updates Rydah&apos;s sandbox ledger. It does not send money to a real bank account.
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
            <p className="text-sm text-zinc-500">Pending requests</p>
            <p className="mt-2 text-3xl font-black text-[#D4AF37]">{pendingCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
            <p className="text-sm text-zinc-500">Pending amount</p>
            <p className="mt-2 text-3xl font-black">{naira(pendingTotal)}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
            <p className="text-sm text-zinc-500">Marked paid</p>
            <p className="mt-2 text-3xl font-black text-emerald-400">{naira(paidTotal)}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">PAYOUT QUEUE</p>
            <h2 className="mt-1 text-3xl font-black">Requests</h2>
          </div>
          {session && <button onClick={() => void load(getStoredSession() ?? session)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh</button>}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-black">{payout.providers?.business_name || "Provider"}</h3>
                      {payout.is_test && <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-black text-[#D4AF37]">TEST</span>}
                    </div>
                    <p className="mt-2 text-zinc-400">{payout.providers?.service_category || "Service"} • {payout.providers?.location || "Location"}</p>
                    <p className="mt-2 text-sm text-zinc-500">Requested {new Date(payout.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-[#D4AF37]">{naira(payout.amount_naira)}</p>
                    <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${payout.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : payout.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>{payout.status.toUpperCase()}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#1A1A1A] p-4">
                    <p className="text-xs text-zinc-500">Bank</p>
                    <p className="mt-1 font-bold">{payout.bank_name}</p>
                  </div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-4">
                    <p className="text-xs text-zinc-500">Account name</p>
                    <p className="mt-1 font-bold">{payout.account_name}</p>
                  </div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-4">
                    <p className="text-xs text-zinc-500">Account</p>
                    <p className="mt-1 font-bold">••••{payout.account_last4}</p>
                  </div>
                </div>

                {payout.paid_reference && <p className="mt-4 break-all text-sm text-zinc-400">Payout reference: {payout.paid_reference}</p>}
                {payout.admin_note && <p className="mt-2 text-sm text-zinc-400">Admin note: {payout.admin_note}</p>}

                {payout.status === "pending" && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button disabled={workingId === payout.id} onClick={() => void review(payout, "paid")} className="rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black disabled:opacity-50">
                      {workingId === payout.id ? "Processing..." : "Mark Test Paid"}
                    </button>
                    <button disabled={workingId === payout.id} onClick={() => void review(payout, "rejected")} className="rounded-2xl border border-red-500/30 px-5 py-3 font-black text-red-300 disabled:opacity-50">
                      Reject
                    </button>
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
