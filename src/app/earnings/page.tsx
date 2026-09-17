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
  commission_rate_percent: number | string;
  commission_amount_naira: number;
  provider_net_naira: number;
  commission_status: string;
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

function commissionStatusLabel(value: string) {
  if (value === "owed_by_provider") return "Commission owed to Rydah";
  if (value === "withheld") return "Commission retained";
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
        `payments?provider_id=eq.${currentProvider.id}&select=id,job_id,amount_naira,method,status,reference,is_test,commission_rate_percent,commission_amount_naira,provider_net_naira,commission_status,created_at,jobs(service_category,location)&order=created_at.desc`,
        currentSession.access_token,
      );
      setPayments(paymentRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load earnings.");
    } finally {
      setLoading(false);
    }
  }

  const settledPayments = useMemo(
    () => payments.filter((payment) => ["paid", "cash_due"].includes(payment.status)),
    [payments],
  );
  const liveSettled = useMemo(() => settledPayments.filter((payment) => !payment.is_test), [settledPayments]);
  const testSettled = useMemo(() => settledPayments.filter((payment) => payment.is_test), [settledPayments]);

  const grossPaid = useMemo(
    () => liveSettled.reduce((sum, payment) => sum + Number(payment.amount_naira || 0), 0),
    [liveSettled],
  );
  const rydahCommission = useMemo(
    () => liveSettled.reduce((sum, payment) => sum + Number(payment.commission_amount_naira || 0), 0),
    [liveSettled],
  );
  const providerNet = useMemo(
    () => liveSettled.reduce((sum, payment) => sum + Number(payment.provider_net_naira || 0), 0),
    [liveSettled],
  );
  const commissionOwed = useMemo(
    () => liveSettled
      .filter((payment) => payment.commission_status === "owed_by_provider")
      .reduce((sum, payment) => sum + Number(payment.commission_amount_naira || 0), 0),
    [liveSettled],
  );
  const testGross = useMemo(
    () => testSettled.reduce((sum, payment) => sum + Number(payment.amount_naira || 0), 0),
    [testSettled],
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
              <p className="mt-2 text-zinc-400">Live earnings are kept separate from Rydah sandbox and launch-test activity.</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Live gross job value</p>
                <p className="mt-2 text-3xl font-black">{naira(grossPaid)}</p>
                <p className="mt-2 text-xs text-zinc-500">Real settled customer payments only.</p>
              </div>
              <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Rydah commission</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(rydahCommission)}</p>
                <p className="mt-2 text-xs text-zinc-500">15% on live settled jobs.</p>
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Your live net earnings</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">{naira(providerNet)}</p>
                <p className="mt-2 text-xs text-zinc-500">Live gross less Rydah commission.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Live commission owed</p>
                <p className="mt-2 text-3xl font-black">{naira(commissionOwed)}</p>
                <p className="mt-2 text-xs text-zinc-500">Cash commission actually owed to Rydah.</p>
              </div>
            </div>

            {testGross > 0 && (
              <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
                Test activity kept separate: {naira(testGross)}. These test records do not count toward live earnings or money owed.
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
                          <p className="text-2xl font-black">{naira(payment.amount_naira)}</p>
                          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>
                            {payment.status.replaceAll("_", " ").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Method</p>
                          <p className="mt-1 font-bold">{paymentMethod(payment.method)}</p>
                        </div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Rydah commission</p>
                          <p className="mt-1 font-bold text-[#D4AF37]">{naira(payment.commission_amount_naira)} ({Number(payment.commission_rate_percent)}%)</p>
                        </div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Provider net</p>
                          <p className="mt-1 font-bold text-emerald-400">{naira(payment.provider_net_naira)}</p>
                        </div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4">
                          <p className="text-xs text-zinc-500">Commission status</p>
                          <p className="mt-1 text-sm font-bold">{commissionStatusLabel(payment.commission_status)}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-[#1A1A1A] p-4">
                        <p className="text-xs text-zinc-500">Reference</p>
                        <p className="mt-1 break-all text-sm font-bold">{payment.reference}</p>
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
