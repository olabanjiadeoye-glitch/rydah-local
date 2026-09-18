"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";

type AdminRow = { user_id: string };
type SettingRow = { key: string; value_numeric: number | string; description: string | null };
type PaymentRow = {
  id: string;
  amount_naira: number;
  commission_rate_percent: number | string;
  commission_amount_naira: number;
  provider_net_naira: number;
  commission_status: string;
  status: string;
  is_test: boolean;
  method: string;
  created_at: string;
  providers: { business_name: string } | null;
  jobs: { service_category: string; location: string } | null;
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function AdminFinancePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [rate, setRate] = useState("15");
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
      const admins = await restGet<AdminRow[]>(
        `admin_users?user_id=eq.${currentSession.user.id}&select=user_id&limit=1`,
        currentSession.access_token,
      );
      if (!admins[0]) throw new Error("Admin access is required.");

      const [settings, paymentRows] = await Promise.all([
        restGet<SettingRow[]>(
          "platform_settings?key=eq.commission_rate_percent&select=key,value_numeric,description&limit=1",
          currentSession.access_token,
        ),
        restGet<PaymentRow[]>(
          "payments?select=id,amount_naira,commission_rate_percent,commission_amount_naira,provider_net_naira,commission_status,status,is_test,method,created_at,providers(business_name),jobs(service_category,location)&order=created_at.desc",
          currentSession.access_token,
        ),
      ]);

      if (settings[0]) setRate(String(Number(settings[0].value_numeric)));
      setPayments(paymentRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load Rydah finance.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      setError("Commission must be between 0% and 100%.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await restPatch<SettingRow[]>(
        "platform_settings",
        "key=eq.commission_rate_percent",
        { value_numeric: numericRate, updated_at: new Date().toISOString() },
        session.access_token,
      );
      setMessage(`Rydah commission set to ${numericRate}%. New payments will use this rate; historic transactions keep their original rate.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update commission rate.");
    } finally {
      setSaving(false);
    }
  }

  const countedPayments = useMemo(
    () => payments.filter((payment) => ["paid", "cash_due"].includes(payment.status)),
    [payments],
  );
  const gross = useMemo(() => countedPayments.reduce((sum, p) => sum + Number(p.amount_naira || 0), 0), [countedPayments]);
  const commission = useMemo(() => countedPayments.reduce((sum, p) => sum + Number(p.commission_amount_naira || 0), 0), [countedPayments]);
  const providerNet = useMemo(() => countedPayments.reduce((sum, p) => sum + Number(p.provider_net_naira || 0), 0), [countedPayments]);
  const cashOwed = useMemo(() => countedPayments.filter((p) => p.commission_status === "owed_by_provider").reduce((sum, p) => sum + Number(p.commission_amount_naira || 0), 0), [countedPayments]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH ADMIN</p>
            <h1 className="mt-1 text-2xl font-black">Finance & Commission</h1>
          </div>
          <div className="flex gap-2">
            <a href="/admin/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Provider Admin</a>
            <a href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Marketplace</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-7 sm:py-6">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading finance dashboard...</div>
        ) : (
          <>
            {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}
            {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}

            {!error && (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Gross job value</p><p className="mt-2 text-3xl font-black">{naira(gross)}</p></div>
                  <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Rydah revenue</p><p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(commission)}</p><p className="mt-2 text-xs text-zinc-500">Commission on processed jobs.</p></div>
                  <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Provider net</p><p className="mt-2 text-3xl font-black text-emerald-400">{naira(providerNet)}</p></div>
                  <div className="rounded-3xl border border-white/10 bg-[#121212] p-6"><p className="text-sm text-zinc-500">Cash commission due</p><p className="mt-2 text-3xl font-black">{naira(cashOwed)}</p></div>
                </div>

                <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">PLATFORM RULE</p>
                  <h2 className="mt-2 text-2xl font-black">Rydah commission percentage</h2>
                  <p className="mt-2 text-sm text-zinc-400">This rate is locked into every new payment record. Changing it later will not rewrite old transactions.</p>
                  <form onSubmit={saveRate} className="mt-5 flex max-w-md flex-wrap items-end gap-3">
                    <label className="flex-1">
                      <span className="text-sm font-bold">Commission %</span>
                      <input value={rate} onChange={(event) => setRate(event.target.value)} type="number" min="0" max="100" step="0.01" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
                    </label>
                    <button disabled={saving} className="rounded-2xl bg-[#D4AF37] px-6 py-4 font-black text-black disabled:opacity-50">{saving ? "Saving..." : "Save Rate"}</button>
                  </form>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">COMMISSION LEDGER</p>
                  <h2 className="mt-1 text-3xl font-black">Transactions</h2>
                  <div className="mt-5 grid gap-4">
                    {payments.length === 0 ? (
                      <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No payment records yet.</div>
                    ) : payments.map((payment) => (
                      <article key={payment.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black">{payment.jobs?.service_category || "Rydah Job"}</h3>{payment.is_test && <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-black text-[#D4AF37]">TEST</span>}</div>
                            <p className="mt-2 text-zinc-400">{payment.providers?.business_name || "Provider"} • {payment.jobs?.location || "Location"}</p>
                            <p className="mt-2 text-sm text-zinc-500">{new Date(payment.created_at).toLocaleString()}</p>
                          </div>
                          <div className="text-right"><p className="text-sm text-zinc-500">Gross</p><p className="text-2xl font-black">{naira(payment.amount_naira)}</p></div>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Rydah commission</p><p className="mt-1 font-black text-[#D4AF37]">{naira(payment.commission_amount_naira)} ({Number(payment.commission_rate_percent)}%)</p></div>
                          <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Provider net</p><p className="mt-1 font-black text-emerald-400">{naira(payment.provider_net_naira)}</p></div>
                          <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Commission status</p><p className="mt-1 font-black">{payment.commission_status.replaceAll("_", " ")}</p></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
