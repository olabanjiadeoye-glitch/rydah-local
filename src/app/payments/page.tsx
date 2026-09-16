"use client";

import { useEffect, useState } from "react";
import { getStoredSession, restGet, restInsert, type AuthSession } from "@/lib/supabase";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  status: string;
  quoted_amount: number | null;
  payment_status: string;
  quote_status: string;
  providers: { business_name: string; starting_price: number | null } | null;
};

type PaymentRow = {
  id: string;
  job_id: string;
  amount_naira: number;
  method: "paystack" | "cash" | "sandbox_card";
  status: "pending" | "paid" | "cash_due" | "failed" | "refunded" | "cancelled";
  reference: string;
  is_test: boolean;
  gateway: string;
  gateway_channel: string | null;
  commission_rate_percent: number | string;
  commission_amount_naira: number;
  provider_net_naira: number;
  commission_status: "pending" | "withheld" | "owed_by_provider" | "refunded";
  created_at: string;
};

type SettingRow = {
  key: string;
  value_numeric: number | string;
};

type BackendResponse = {
  authorization_url?: string;
  reference?: string;
  status?: string;
  ok?: boolean;
  error?: string;
};

function naira(value: number) {
  return `₦${value.toLocaleString()}`;
}

function methodLabel(payment: PaymentRow) {
  if (payment.method === "paystack") {
    return payment.gateway_channel ? `Paystack • ${payment.gateway_channel}` : "Paystack";
  }
  if (payment.method === "cash") return "Cash";
  return "Sandbox card";
}

async function callPaymentBackend(session: AuthSession, payload: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Payment service is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as BackendResponse;
  if (!response.ok) throw new Error(result.error || "Unable to process payment.");
  return result;
}

export default function PaymentsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [commissionRate, setCommissionRate] = useState(15);
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
    void load(currentSession, true);
  }, []);

  async function load(currentSession: AuthSession, verifyCallback = false) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get("job");
      if (!jobId) throw new Error("No job was selected for payment.");

      if (verifyCallback) {
        const reference = params.get("reference") || params.get("trxref");
        if (reference) {
          setMessage("Confirming your payment with Paystack…");
          try {
            const verified = await callPaymentBackend(currentSession, { action: "verify", reference });
            if (verified.status === "paid") {
              setMessage("Payment confirmed successfully.");
            }
          } catch (caught) {
            setMessage("");
            setError(caught instanceof Error ? caught.message : "We could not verify this payment yet.");
          }
          window.history.replaceState({}, "", `/payments?job=${encodeURIComponent(jobId)}`);
        }
      }

      const [jobs, settings] = await Promise.all([
        restGet<JobRow[]>(
          `jobs?id=eq.${encodeURIComponent(jobId)}&customer_id=eq.${currentSession.user.id}&select=id,provider_id,service_category,location,status,quoted_amount,payment_status,quote_status,providers(business_name,starting_price)&limit=1`,
          currentSession.access_token,
        ),
        restGet<SettingRow[]>(
          "platform_settings?key=eq.commission_rate_percent&select=key,value_numeric&limit=1",
          currentSession.access_token,
        ),
      ]);

      const currentJob = jobs[0] ?? null;
      if (!currentJob) throw new Error("This job could not be found.");
      setJob(currentJob);
      if (settings[0]) setCommissionRate(Number(settings[0].value_numeric));

      const payments = await restGet<PaymentRow[]>(
        `payments?job_id=eq.${currentJob.id}&customer_id=eq.${currentSession.user.id}&select=*&order=created_at.desc&limit=1`,
        currentSession.access_token,
      );
      setPayment(payments[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payment details.");
    } finally {
      setLoading(false);
    }
  }

  async function startPaystackPayment() {
    if (!session || !job) return;
    setSaving(true);
    setError("");
    setMessage("Opening secure Paystack checkout…");

    try {
      const callbackUrl = `${window.location.origin}/payments?job=${encodeURIComponent(job.id)}`;
      const result = await callPaymentBackend(session, {
        action: "initialize",
        job_id: job.id,
        callback_url: callbackUrl,
      });

      if (!result.authorization_url) throw new Error("Paystack did not return a checkout link.");
      window.location.assign(result.authorization_url);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to start Paystack checkout.");
      setSaving(false);
    }
  }

  async function verifyLatestPayment() {
    if (!session || !payment || payment.method !== "paystack") return;
    setSaving(true);
    setError("");
    setMessage("Checking payment status…");

    try {
      const result = await callPaymentBackend(session, { action: "verify", reference: payment.reference });
      if (result.status === "paid") setMessage("Payment confirmed successfully.");
      await load(session, false);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Payment has not been confirmed yet.");
    } finally {
      setSaving(false);
    }
  }

  async function selectCash() {
    if (!session || !job) return;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const rows = await restInsert<PaymentRow[]>(
        "payments",
        { job_id: job.id, method: "cash" },
        session.access_token,
      );
      const created = rows[0];
      if (!created) throw new Error("Cash payment record was not returned.");
      setPayment(created);
      setJob((current) => current ? { ...current, payment_status: created.status } : current);
      setMessage("Cash selected. Pay the provider directly when the job is settled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to select cash payment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading payment…</main>;
  }

  const amount = job?.quoted_amount ?? job?.providers?.starting_price ?? 0;
  const effectiveRate = payment ? Number(payment.commission_rate_percent) : commissionRate;
  const commissionAmount = payment?.commission_amount_naira ?? Math.round(amount * effectiveRate / 100);
  const providerNet = payment?.provider_net_naira ?? Math.max(0, amount - commissionAmount);
  const cashAllowed = amount > 0 && amount <= 5000;
  const isSettled = payment?.status === "paid" || payment?.status === "cash_due";
  const canPay = Boolean(job && job.status === "completed" && job.quote_status === "accepted" && amount > 0 && !isSettled);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Payment</h1>
          </div>
          <a href="/my-jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">My Jobs</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-4 text-sm text-[#E7C85A]">
          Secure checkout is handled by Paystack. Rydah never asks you to enter card details directly on this page.
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

        {job && (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">JOB PAYMENT</p>
                <h2 className="mt-2 text-3xl font-black">{job.service_category}</h2>
                <p className="mt-2 text-zinc-400">{job.providers?.business_name ?? "Provider"} • {job.location}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-500">Customer total</p>
                <p className="text-3xl font-black text-[#D4AF37]">{amount ? naira(amount) : "Not set"}</p>
              </div>
            </div>

            {amount > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#1A1A1A] p-4">
                  <p className="text-xs text-zinc-500">Rydah commission</p>
                  <p className="mt-1 text-lg font-black">{effectiveRate}%</p>
                  <p className="mt-1 text-sm text-[#D4AF37]">{naira(commissionAmount)}</p>
                </div>
                <div className="rounded-2xl bg-[#1A1A1A] p-4">
                  <p className="text-xs text-zinc-500">Provider net</p>
                  <p className="mt-1 text-lg font-black">{naira(providerNet)}</p>
                  <p className="mt-1 text-xs text-zinc-500">After Rydah commission</p>
                </div>
                <div className="rounded-2xl bg-[#1A1A1A] p-4">
                  <p className="text-xs text-zinc-500">Your charge</p>
                  <p className="mt-1 text-lg font-black">{naira(amount)}</p>
                  <p className="mt-1 text-xs text-zinc-500">No extra Rydah fee</p>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-zinc-500">
              Rydah deducts {effectiveRate}% from provider earnings. This does not increase the customer&apos;s agreed job price.
            </p>

            {payment && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#1A1A1A] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">Latest payment</p>
                    <p className="mt-1 text-lg font-black">{methodLabel(payment)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-xs font-black ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : payment.status === "failed" ? "bg-red-500/15 text-red-300" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>
                    {payment.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="mt-4 break-all text-sm text-zinc-400">Reference: {payment.reference}</p>
                <p className="mt-2 text-sm text-zinc-400">Rydah commission: {naira(payment.commission_amount_naira)} ({Number(payment.commission_rate_percent)}%)</p>
                <p className="mt-1 text-sm text-zinc-400">Provider net: {naira(payment.provider_net_naira)}</p>
                {payment.is_test && <p className="mt-2 text-xs text-amber-300">Paystack test transaction — no real funds moved.</p>}
              </div>
            )}

            {!canPay && !isSettled && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4 text-sm text-zinc-400">
                Payment becomes available after the provider has completed the job and you have accepted the agreed quote.
              </div>
            )}

            {canPay && (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button disabled={saving} onClick={() => void startPaystackPayment()} className="rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">
                  {saving ? "Please wait…" : `Pay ${naira(amount)} with Paystack`}
                </button>
                <button disabled={saving || !cashAllowed} onClick={() => void selectCash()} className="rounded-2xl border border-white/10 px-5 py-4 font-bold disabled:opacity-35">
                  Cash {cashAllowed ? "" : "(Not available)"}
                </button>
              </div>
            )}

            {payment?.method === "paystack" && payment.status === "pending" && (
              <button disabled={saving} onClick={() => void verifyLatestPayment()} className="mt-3 w-full rounded-2xl border border-[#D4AF37]/40 px-5 py-4 font-bold text-[#D4AF37] disabled:opacity-50">
                Check Paystack payment status
              </button>
            )}

            {!cashAllowed && amount > 5000 && !isSettled && (
              <p className="mt-4 text-sm text-zinc-500">Cash is disabled for jobs above ₦5,000 under the Rydah payment policy.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
