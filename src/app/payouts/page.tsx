"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restInsert, type AuthSession } from "@/lib/supabase";

type ProviderRow = {
  id: string;
  business_name: string;
};

type PaymentRow = {
  id: string;
  provider_net_naira: number;
  status: string;
  commission_status: string;
  is_test: boolean;
};

type PayoutRow = {
  id: string;
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
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function PayoutsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const providerRows = await restGet<ProviderRow[]>(
        `providers?user_id=eq.${currentSession.user.id}&select=id,business_name&limit=1`,
        currentSession.access_token,
      );
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);

      if (!currentProvider) {
        setPayments([]);
        setPayouts([]);
        return;
      }

      const [paymentRows, payoutRows] = await Promise.all([
        restGet<PaymentRow[]>(
          `payments?provider_id=eq.${currentProvider.id}&select=id,provider_net_naira,status,commission_status,is_test`,
          currentSession.access_token,
        ),
        restGet<PayoutRow[]>(
          `payout_requests?provider_id=eq.${currentProvider.id}&select=id,amount_naira,bank_name,account_name,account_last4,status,is_test,requested_at,reviewed_at,admin_note,paid_reference&order=requested_at.desc`,
          currentSession.access_token,
        ),
      ]);

      setPayments(paymentRows);
      setPayouts(payoutRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }

  const earned = useMemo(
    () =>
      payments
        .filter((payment) => payment.is_test && payment.status === "paid" && payment.commission_status === "withheld")
        .reduce((sum, payment) => sum + Number(payment.provider_net_naira || 0), 0),
    [payments],
  );

  const reserved = useMemo(
    () =>
      payouts
        .filter((payout) => payout.is_test && ["pending", "paid"].includes(payout.status))
        .reduce((sum, payout) => sum + Number(payout.amount_naira || 0), 0),
    [payouts],
  );

  const available = Math.max(0, earned - reserved);
  const pending = useMemo(
    () => payouts.filter((payout) => payout.status === "pending").reduce((sum, payout) => sum + Number(payout.amount_naira || 0), 0),
    [payouts],
  );
  const paid = useMemo(
    () => payouts.filter((payout) => payout.status === "paid").reduce((sum, payout) => sum + Number(payout.amount_naira || 0), 0),
    [payouts],
  );

  async function submitPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !provider) return;

    const numericAmount = Math.floor(Number(amount));
    const digits = accountNumber.replace(/\D/g, "");

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid payout amount.");
      return;
    }
    if (numericAmount > available) {
      setError(`You can request up to ${naira(available)} right now.`);
      return;
    }
    if (bankName.trim().length < 2 || accountName.trim().length < 2) {
      setError("Enter the bank name and account name.");
      return;
    }
    if (digits.length < 4) {
      setError("Enter at least the last 4 digits of the test account number.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await restInsert<PayoutRow[]>(
        "payout_requests",
        {
          provider_id: provider.id,
          user_id: session.user.id,
          amount_naira: numericAmount,
          bank_name: bankName.trim(),
          account_name: accountName.trim(),
          account_last4: digits.slice(-4),
          is_test: true,
        },
        session.access_token,
      );

      setMessage("Sandbox payout request submitted for admin review. No real bank transfer has been initiated.");
      setAmount("");
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      await load(getStoredSession() ?? session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request payout.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Payouts</h1>
          </div>
          <div className="flex gap-2">
            <a href="/earnings" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Earnings</a>
            <a href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Dashboard</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-6 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
          TEST MODE — payout requests are simulated. Do not enter real bank details. Only the final 4 digits of the test account number are stored.
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading payout balance...</div>
        ) : error && !provider ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-6 text-red-300">{error}</div>
        ) : !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">No provider profile found.</div>
        ) : (
          <>
            <div>
              <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">PAYOUT BALANCE</p>
              <h2 className="mt-1 text-3xl font-black">{provider.business_name}</h2>
              <p className="mt-2 text-zinc-400">Your balance already reflects Rydah&apos;s 15% commission on each paid job.</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Available to request</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">{naira(available)}</p>
              </div>
              <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Pending payout</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(pending)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Marked paid</p>
                <p className="mt-2 text-3xl font-black">{naira(paid)}</p>
              </div>
            </div>

            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

            <form onSubmit={submitPayout} className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">REQUEST PAYOUT</p>
              <h3 className="mt-2 text-2xl font-black">Withdraw provider balance</h3>
              <p className="mt-2 text-sm text-zinc-400">Admin approval is required before a sandbox payout is marked paid.</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-bold">Amount</span>
                  <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" max={available || undefined} placeholder={available ? String(available) : "0"} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>
                <label>
                  <span className="text-sm font-bold">Bank name</span>
                  <input value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Test Bank" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>
                <label>
                  <span className="text-sm font-bold">Account name</span>
                  <input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Test Provider" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>
                <label>
                  <span className="text-sm font-bold">Test account number</span>
                  <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} inputMode="numeric" placeholder="00001234" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                  <span className="mt-2 block text-xs text-zinc-500">Only the final 4 digits are sent to the database.</span>
                </label>
              </div>

              <button disabled={saving || available <= 0} className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-6 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? "Submitting..." : available > 0 ? "Request Test Payout" : "No Balance Available"}
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">PAYOUT HISTORY</p>
                  <h2 className="mt-1 text-3xl font-black">Requests</h2>
                </div>
                {session && <button onClick={() => void load(getStoredSession() ?? session)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh</button>}
              </div>

              <div className="mt-5 grid gap-4">
                {payouts.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No payout requests yet.</div>
                ) : payouts.map((payout) => (
                  <article key={payout.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-2xl font-black">{naira(payout.amount_naira)}</p>
                        <p className="mt-2 text-zinc-400">{payout.bank_name} • {payout.account_name} ••••{payout.account_last4}</p>
                        <p className="mt-2 text-sm text-zinc-500">Requested {new Date(payout.requested_at).toLocaleString()}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${payout.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : payout.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>{payout.status.toUpperCase()}</span>
                    </div>
                    {payout.paid_reference && <p className="mt-4 break-all text-sm text-zinc-400">Reference: {payout.paid_reference}</p>}
                    {payout.admin_note && <p className="mt-2 text-sm text-zinc-400">Admin note: {payout.admin_note}</p>}
                  </article>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
