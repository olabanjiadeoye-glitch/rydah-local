"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, type AuthSession, invokeFunction } from "@/lib/supabase";

type ProviderRow = { id: string; business_name: string };
type PaymentRow = {
  id: string;
  provider_net_naira: number;
  status: string;
  commission_status: string;
  is_test: boolean;
  provider_settlement_mode: "manual" | "split";
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
type PayoutAccountRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_last4: string;
  status: string;
  is_test: boolean;
  gateway_subaccount_code: string | null;
};
type BankOption = { name: string; code: string };
type BackendResponse = {
  ok?: boolean;
  error?: string;
  banks?: BankOption[];
  account?: PayoutAccountRow | null;
  payout?: PayoutRow | null;
  mode?: string;
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

async function callProviderBackend(session: AuthSession, payload: Record<string, unknown>) {
  const response = await invokeFunction("paystack-provider", payload, session.access_token);

  const result = (await response.json().catch(() => ({}))) as BackendResponse;
  if (!response.ok) throw new Error(result.error || "Unable to process provider settlement request.");
  return result;
}

export default function PayoutsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [account, setAccount] = useState<PayoutAccountRow | null>(null);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
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
        setAccount(null);
        return;
      }

      const [paymentRows, payoutRows, accountRows] = await Promise.all([
        restGet<PaymentRow[]>(
          `payments?provider_id=eq.${currentProvider.id}&select=id,provider_net_naira,status,commission_status,is_test,provider_settlement_mode`,
          currentSession.access_token,
        ),
        restGet<PayoutRow[]>(
          `payout_requests?provider_id=eq.${currentProvider.id}&select=id,amount_naira,bank_name,account_name,account_last4,status,is_test,requested_at,reviewed_at,admin_note,paid_reference&order=requested_at.desc`,
          currentSession.access_token,
        ),
        restGet<PayoutAccountRow[]>(
          `provider_payout_accounts?provider_id=eq.${currentProvider.id}&select=id,bank_name,account_name,account_last4,status,is_test,gateway_subaccount_code&limit=1`,
          currentSession.access_token,
        ),
      ]);
      setPayments(paymentRows);
      setPayouts(payoutRows);
      setAccount(accountRows[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load provider settlements.");
    } finally {
      setLoading(false);
    }
  }

  const manualEarned = useMemo(
    () => payments
      .filter((p) => !p.is_test && p.status === "paid" && p.commission_status === "withheld" && p.provider_settlement_mode === "manual")
      .reduce((sum, p) => sum + Number(p.provider_net_naira || 0), 0),
    [payments],
  );
  const reserved = useMemo(
    () => payouts
      .filter((p) => !p.is_test && ["pending", "paid"].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount_naira || 0), 0),
    [payouts],
  );
  const available = Math.max(0, manualEarned - reserved);
  const pending = useMemo(
    () => payouts.filter((p) => !p.is_test && p.status === "pending").reduce((sum, p) => sum + Number(p.amount_naira || 0), 0),
    [payouts],
  );
  const paid = useMemo(
    () => payouts.filter((p) => !p.is_test && p.status === "paid").reduce((sum, p) => sum + Number(p.amount_naira || 0), 0),
    [payouts],
  );
  const splitSettled = useMemo(
    () => payments
      .filter((p) => !p.is_test && p.status === "paid" && p.provider_settlement_mode === "split")
      .reduce((sum, p) => sum + Number(p.provider_net_naira || 0), 0),
    [payments],
  );

  async function loadBanks() {
    if (!session) return;
    setSaving(true);
    setError("");
    try {
      const result = await callProviderBackend(session, { action: "list_banks" });
      setBanks(result.banks ?? []);
      if (!(result.banks ?? []).length) throw new Error("No Nigerian banks were returned by Paystack.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load banks.");
    } finally {
      setSaving(false);
    }
  }

  async function savePayoutAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await callProviderBackend(session, {
        action: "save_account",
        bank_code: bankCode,
        account_number: accountNumber,
      });
      setAccount(result.account ?? null);
      setAccountNumber("");
      setMessage("Settlement account connected. Future Paystack payments can now split the provider share automatically.");
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to connect the settlement account.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const numericAmount = Math.floor(Number(amount));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid payout amount.");
      return;
    }
    if (numericAmount > available) {
      setError(`You can request up to ${naira(available)} right now.`);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await callProviderBackend(session, { action: "request_payout", amount: numericAmount });
      setAmount("");
      setMessage("Payout request submitted for Rydah admin review.");
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request payout.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#080808] p-5 sm:p-6 text-zinc-400">Loading provider settlements…</main>;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Settlements</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/earnings" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Earnings</Link>
            <Link href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Dashboard</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-6 sm:py-8">
        {!provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">No provider profile found.</div>
        ) : (
          <>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-sm text-emerald-300">
              LIVE SETTLEMENTS — bank details are sent securely to Paystack. Rydah stores only the bank name, resolved account name and last 4 digits.
            </div>

            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

            <div className="mt-7">
              <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">SETTLEMENT ACCOUNT</p>
              <h2 className="mt-1 text-3xl font-black">{provider.business_name}</h2>
            </div>

            {account && !account.is_test && account.status === "verified" ? (
              <div className="mt-5 rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-500">Connected bank account</p>
                    <p className="mt-2 text-xl font-black">{account.bank_name}</p>
                    <p className="mt-1 text-zinc-300">{account.account_name} ••••{account.account_last4}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-400">VERIFIED</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">New eligible Paystack jobs will use split settlement: Rydah keeps its 15% commission and the provider share is routed through the Paystack subaccount settlement flow.</p>
              </div>
            ) : (
              <form onSubmit={savePayoutAccount} className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">CONNECT BANK ACCOUNT</p>
                <p className="mt-2 text-sm text-zinc-400">Connect the provider’s Nigerian bank account. The full account number is never stored in the Rydah database.</p>
                {banks.length === 0 ? (
                  <button type="button" disabled={saving} onClick={() => void loadBanks()} className="mt-5 rounded-2xl border border-[#D4AF37]/40 px-5 py-3 font-bold text-[#D4AF37] disabled:opacity-50">{saving ? "Loading…" : "Load Nigerian Banks"}</button>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="text-sm font-bold">Bank</span>
                      <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} required className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                        <option value="">Choose bank</option>
                        {banks.map((bank) => <option key={`${bank.code}-${bank.name}`} value={bank.code}>{bank.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="text-sm font-bold">Account number</span>
                      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" maxLength={10} placeholder="10-digit account number" required className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                    </label>
                    <button disabled={saving || !bankCode || accountNumber.replace(/\D/g, "").length !== 10} className="sm:col-span-2 rounded-2xl bg-[#D4AF37] px-6 py-4 font-black text-black disabled:opacity-40">{saving ? "Connecting…" : "Verify & Connect with Paystack"}</button>
                  </div>
                )}
              </form>
            )}

            <div className="mt-7 grid gap-4 sm:grid-cols-4">
              <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Available manual balance</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">{naira(available)}</p>
              </div>
              <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Pending payout</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(pending)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Manual payouts paid</p>
                <p className="mt-2 text-3xl font-black">{naira(paid)}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Split-settled earnings</p>
                <p className="mt-2 text-3xl font-black">{naira(splitSettled)}</p>
              </div>
            </div>

            {available > 0 && (
              <form onSubmit={submitPayout} className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">EXISTING BALANCE</p>
                <h3 className="mt-2 text-2xl font-black">Request manual payout</h3>
                <p className="mt-2 text-sm text-zinc-400">This covers provider earnings collected before split settlement was connected. Rydah admin must confirm the external bank transfer before it is marked paid.</p>
                <label className="mt-5 block">
                  <span className="text-sm font-bold">Amount</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="1" max={available} placeholder={String(available)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                </label>
                <button disabled={saving || !account || account.is_test || account.status !== "verified"} className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-6 py-4 font-black text-black disabled:opacity-40">{saving ? "Submitting…" : `Request up to ${naira(available)}`}</button>
              </form>
            )}

            <div className="mt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">PAYOUT HISTORY</p>
                  <h2 className="mt-1 text-3xl font-black">Requests</h2>
                </div>
                {session && <button onClick={() => void load(session)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh</button>}
              </div>
              <div className="mt-5 grid gap-4">
                {payouts.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No payout requests yet.</div>
                ) : payouts.map((payout) => (
                  <article key={payout.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2"><p className="text-2xl font-black">{naira(payout.amount_naira)}</p>{payout.is_test && <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs font-black text-amber-300">TEST</span>}</div>
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
