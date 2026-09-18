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

type SettingRow = {
  key: string;
  value_numeric: number | string;
};

type CommissionBackendResponse = {
  authorization_url?: string;
  reference?: string;
  amount_naira?: number;
  status?: string;
  ok?: boolean;
  error?: string;
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
  if (value === "settled_by_provider") return "Commission settled";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function callCommissionBackend(session: AuthSession, payload: Record<string, unknown>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!supabaseUrl || !publishableKey) throw new Error("Commission settlement service is not configured.");

  const response = await fetch(`${supabaseUrl}/functions/v1/commission-settlement`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json().catch(() => ({}))) as CommissionBackendResponse;
  if (!response.ok) throw new Error(result.error || "Unable to process commission settlement.");
  return result;
}

export default function EarningsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [debtLimit, setDebtLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingCommission, setSavingCommission] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }
    setSession(currentSession);
    void loadEarnings(currentSession, true);
  }, []);

  async function loadEarnings(currentSession: AuthSession, verifyCallback = false) {
    setLoading(true);
    setError("");
    try {
      if (verifyCallback) {
        const params = new URLSearchParams(window.location.search);
        const reference = params.get("reference") || params.get("trxref");
        if (reference?.startsWith("RYD-COM-")) {
          setMessage("Confirming your Rydah commission payment with Paystack…");
          try {
            const verified = await callCommissionBackend(currentSession, { action: "verify", reference });
            if (verified.status === "paid") setMessage(`Commission payment${verified.amount_naira ? ` of ${naira(Number(verified.amount_naira))}` : ""} confirmed.`);
          } catch (caught) {
            setMessage("");
            setError(caught instanceof Error ? caught.message : "Commission payment could not be verified yet.");
          }
          window.history.replaceState({}, "", "/earnings");
        }
      }

      const [providerRows, settings] = await Promise.all([
        restGet<ProviderRow[]>(
          `providers?user_id=eq.${currentSession.user.id}&select=id,business_name&limit=1`,
          currentSession.access_token,
        ),
        restGet<SettingRow[]>(
          "platform_settings?key=eq.cash_commission_debt_limit_naira&select=key,value_numeric&limit=1",
          currentSession.access_token,
        ).catch(() => []),
      ]);
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);
      if (settings[0]) setDebtLimit(Number(settings[0].value_numeric || 0));
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

  async function settleCommission() {
    if (!session) return;
    setSavingCommission(true);
    setError("");
    setMessage("Opening secure Paystack commission checkout…");
    try {
      const result = await callCommissionBackend(session, { action: "initialize" });
      if (!result.authorization_url) throw new Error("Paystack did not return a commission checkout link.");
      window.location.assign(result.authorization_url);
    } catch (caught) {
      setMessage("");
      setError(caught instanceof Error ? caught.message : "Unable to start commission settlement.");
      setSavingCommission(false);
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
  const acceptanceBlocked = debtLimit > 0 && commissionOwed >= debtLimit;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Earnings</h1>
          </div>
          <a href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Provider Dashboard</a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        {message && <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading earnings...</div>
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
              <div className={`rounded-3xl border bg-[#121212] p-6 ${commissionOwed > 0 ? "border-red-500/25" : "border-white/10"}`}>
                <p className="text-sm text-zinc-500">Live commission owed</p>
                <p className={`mt-2 text-3xl font-black ${commissionOwed > 0 ? "text-red-300" : "text-white"}`}>{naira(commissionOwed)}</p>
                <p className="mt-2 text-xs text-zinc-500">Cash-job commission still due to Rydah.</p>
              </div>
            </div>

            {commissionOwed > 0 ? (
              <div className={`mt-5 rounded-3xl border p-6 ${acceptanceBlocked ? "border-red-500/30 bg-red-950/20" : "border-[#D4AF37]/25 bg-[#D4AF37]/5"}`}>
                <p className={`text-xs font-black tracking-[0.18em] ${acceptanceBlocked ? "text-red-300" : "text-[#D4AF37]"}`}>CASH COMMISSION ACCOUNT</p>
                <h3 className="mt-2 text-2xl font-black">Settle {naira(commissionOwed)} securely</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
                  Cash jobs still carry Rydah&apos;s platform commission. Pay the outstanding amount through Paystack so your commission record stays current.
                  {debtLimit > 0 && ` Providers reaching ${naira(debtLimit)} outstanding commission must settle before accepting another job.`}
                </p>
                {acceptanceBlocked && <p className="mt-3 text-sm font-bold text-red-300">New job acceptance is currently paused until the outstanding Rydah commission is settled.</p>}
                <button disabled={savingCommission} onClick={() => void settleCommission()} className="mt-5 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">
                  {savingCommission ? "Opening Paystack…" : `Settle ${naira(commissionOwed)} with Paystack`}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">✓ No live cash commission is outstanding.</div>
            )}

            {testGross > 0 && (
              <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">Test activity kept separate: {naira(testGross)}. These test records do not count toward live earnings or money owed.</div>
            )}

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">PAYMENT HISTORY</p>
                  <h2 className="mt-1 text-3xl font-black">Transactions</h2>
                </div>
                {session && (
                  <button type="button" onClick={() => void loadEarnings(session, false)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh</button>
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
                            {payment.is_test && <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-black text-[#D4AF37]">TEST</span>}
                          </div>
                          <p className="mt-2 text-zinc-400">{payment.jobs?.location || "Location unavailable"}</p>
                          <p className="mt-3 text-sm text-zinc-500">{new Date(payment.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black">{naira(payment.amount_naira)}</p>
                          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${payment.status === "paid" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#D4AF37]/15 text-[#D4AF37]"}`}>{payment.status.replaceAll("_", " ").toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Method</p><p className="mt-1 font-bold">{paymentMethod(payment.method)}</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Rydah commission</p><p className="mt-1 font-bold text-[#D4AF37]">{naira(payment.commission_amount_naira)} ({Number(payment.commission_rate_percent)}%)</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Provider net</p><p className="mt-1 font-bold text-emerald-400">{naira(payment.provider_net_naira)}</p></div>
                        <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Commission status</p><p className="mt-1 text-sm font-bold">{commissionStatusLabel(payment.commission_status)}</p></div>
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
