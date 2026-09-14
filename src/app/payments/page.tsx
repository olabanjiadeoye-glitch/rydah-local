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
  providers: { business_name: string; starting_price: number | null } | null;
};

type PaymentRow = {
  id: string;
  job_id: string;
  amount_naira: number;
  method: "card" | "bank_transfer" | "wallet" | "cash";
  status: "pending" | "paid" | "cash_due" | "failed" | "refunded";
  reference: string;
  is_test: boolean;
  created_at: string;
};

function naira(value: number) {
  return `₦${value.toLocaleString()}`;
}

function methodLabel(method: PaymentRow["method"]) {
  if (method === "bank_transfer") return "Bank transfer";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

export default function PaymentsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
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
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get("job");
      if (!jobId) throw new Error("No job was selected for payment.");

      const jobs = await restGet<JobRow[]>(
        `jobs?id=eq.${encodeURIComponent(jobId)}&customer_id=eq.${currentSession.user.id}&select=id,provider_id,service_category,location,status,quoted_amount,payment_status,providers(business_name,starting_price)&limit=1`,
        currentSession.access_token,
      );
      const currentJob = jobs[0] ?? null;
      if (!currentJob) throw new Error("This job could not be found.");
      setJob(currentJob);

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

  async function createPayment(method: PaymentRow["method"]) {
    if (!session || !job) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const rows = await restInsert<PaymentRow[]>(
        "payments",
        { job_id: job.id, method },
        session.access_token,
      );
      const created = rows[0];
      if (!created) throw new Error("Payment record was not returned.");
      setPayment(created);
      setJob((current) => current ? { ...current, payment_status: created.status } : current);
      setMessage(
        created.status === "paid"
          ? "Sandbox payment successful. No real money was charged."
          : created.status === "cash_due"
            ? "Cash payment selected. Pay the provider directly."
            : "Test payment request created and is pending.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create payment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading payment...</main>;
  }

  const amount = job?.quoted_amount ?? job?.providers?.starting_price ?? 0;
  const cashAllowed = amount > 0 && amount <= 5000;

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
        <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-300">
          TEST MODE — this screen does not charge a real card, bank account or wallet.
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
                <p className="text-sm text-zinc-500">Amount</p>
                <p className="text-3xl font-black text-[#D4AF37]">{amount ? naira(amount) : "Not set"}</p>
              </div>
            </div>

            {payment ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#1A1A1A] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">Latest payment</p>
                    <p className="mt-1 text-lg font-black">{methodLabel(payment.method)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-xs font-black ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>
                    {payment.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="mt-4 text-sm text-zinc-400">Reference: {payment.reference}</p>
                {payment.is_test && <p className="mt-2 text-xs text-amber-300">Sandbox record only — no real funds moved.</p>}
              </div>
            ) : (
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button disabled={saving || !amount} onClick={() => void createPayment("card")} className="rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">
                  Test Card Payment
                </button>
                <button disabled={saving || !amount} onClick={() => void createPayment("bank_transfer")} className="rounded-2xl border border-white/10 px-5 py-4 font-bold disabled:opacity-50">
                  Bank Transfer
                </button>
                <button disabled={saving || !amount} onClick={() => void createPayment("wallet")} className="rounded-2xl border border-white/10 px-5 py-4 font-bold disabled:opacity-50">
                  Rydah Wallet
                </button>
                <button disabled={saving || !cashAllowed} onClick={() => void createPayment("cash")} className="rounded-2xl border border-white/10 px-5 py-4 font-bold disabled:opacity-35">
                  Cash {cashAllowed ? "" : "(Not available)"}
                </button>
              </div>
            )}

            {!cashAllowed && amount > 5000 && (
              <p className="mt-4 text-sm text-zinc-500">Cash is disabled for jobs above ₦5,000 under the Rydah payment policy.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
