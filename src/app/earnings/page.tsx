"use client";

import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

type ProviderRow = {
  id: string;
  business_name: string;
};

type PaymentRow = {
  id: string;
  job_id: string;
  amount_naira: number;
  method: string;
  status: string;
  reference: string;
  is_test: boolean;
  created_at: string;
  jobs: {
    service_category: string;
    location: string;
  } | null;
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

function paymentMethod(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function EarningsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }

    setSession(currentSession);
    void loadEarnings(currentSession);
  }, []);

  async function loadEarnings(currentSession: AuthSession) {
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
        return;
      }

      const paymentRows = await restGet<PaymentRow[]>(
        `payments?provider_id=eq.${currentProvider.id}&select=id,job_id,amount_naira,method,status,reference,is_test,created_at,jobs(service_category,location)&order=created_at.desc`,
        currentSession.access_token,
      );

      setPayments(paymentRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load earnings.");
    } finally {
      setLoading(false);
    }
  }

  const paidPayments = useMemo(
    () => payments.filter((payment) => payment.status === "paid"),
    [payments],
  );

  const grossPaid = useMemo(
    () => paidPayments.reduce((sum, payment) => sum + Number(payment.amount_naira || 0), 0),
    [paidPayments],
  );

  const testPaid = useMemo(
    () => paidPayments.filter((payment) => payment.is_test).reduce((sum, payment) => sum + Number(payment.amount_naira || 0), 0),
    [paidPayments],
  );

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Earnings</h1>
          </div>
          <a href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">
            Provider Dashboard
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading earnings...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-6 text-red-300">{error}</div>
        ) : !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
            <h2 className="text-2xl font-black">No provider profile found</h2>
            <p className="mt-2 text-zinc-400">Create your provider profile before viewing earnings.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">PROVIDER FINANCE</p>
              <h2 className="mt-1 text-3xl font-black">{provider.business_name}</h2>
              <p className="mt-2 text-zinc-400">Track payments received for completed Rydah jobs.</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Gross paid</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(grossPaid)}</p>
                <p className="mt-2 text-xs text-zinc-500">Before future Rydah fees and payout rules.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Paid jobs</p>
                <p className="mt-2 text-3xl font-black">{paidPayments.length}</p>
                <p className="mt-2 text-xs text-zinc-500">Successful payment records.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Settlement</p>
                <p className="mt-2 text-lg font-black">Not connected</p>
                <p className="mt-2 text-xs text-zinc-500">No real provider payout is being sent yet.</p>
              </div>
            </div>

            {testPaid > 0 && (
              <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
                TEST MODE: {naira(testPaid)} of the total above is sandbox payment data. No real money has moved.
              </div>
            )}

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">PAYMENT HISTORY</p>
                  <h2 className="mt-1 text-3xl font-black">Transactions</h2>
                </div>
                {session && (
                  <button
                    type="button"
                    onClick={() => void loadEarnings(session)}
                    className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {payments.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No payments yet.</div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {payments.map((payment) => (
                    <article key={payment.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black">{payment.jobs?.service_category || "Rydah Job"}</h3>
                            {payment.is_test && (
                              <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-black text-[#D4AF37]">TEST</span>
                            )}
                          </div>
                          <p className="mt-2 text-zinc-400">{payment.jobs?.location || "Location unavailable"}</p>
                          <p className="mt-3 text-sm text-zinc-500">{new Date(payment.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-[#D4AF37]">{naira(payment.amount_naira)}</p>
                          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                            {payment.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Method</p>
                          <p className="mt-1 font-bold">{paymentMethod(payment.method)}</p>
                        </div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Reference</p>
                          <p className="mt-1 break-all text-sm font-bold">{payment.reference}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
