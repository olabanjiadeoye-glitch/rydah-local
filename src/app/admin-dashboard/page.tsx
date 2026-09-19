"use client";

import { cityFromServiceArea, displayServiceArea, RYDAH_TARGET_CITIES } from "@/lib/locations";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, type AuthSession } from "@/lib/supabase";

type ProviderRow = {
  id: string;
  business_name: string;
  service_category: string;
  location: string;
  is_verified: boolean;
  is_available: boolean;
  created_at: string;
};

type VerificationRow = {
  id: string;
  provider_id: string;
  status: "draft" | "pending" | "approved" | "rejected";
  submitted_at: string | null;
};

type JobRow = {
  id: string;
  service_category: string;
  location: string;
  status: "open" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled";
  payment_status: "unpaid" | "pending" | "paid" | "cash_due" | "failed" | "refunded";
  is_urgent: boolean;
  created_at: string;
};

type PaymentRow = {
  id: string;
  amount_naira: number;
  commission_amount_naira: number;
  provider_net_naira: number;
  status: string;
  is_test: boolean;
  created_at: string;
};

type PayoutRow = {
  id: string;
  amount_naira: number;
  status: "pending" | "paid" | "rejected";
  is_test: boolean;
  requested_at: string;
};

function naira(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG")}`;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(currentSession);
    void load(currentSession);
  }, []);

  async function load(currentSession: AuthSession) {
    setLoading(true);
    setError("");

    try {
      const admins = await restGet<{ user_id: string }[]>(
        `admin_users?user_id=eq.${currentSession.user.id}&select=user_id&limit=1`,
        currentSession.access_token,
      );
      if (!admins[0]) throw new Error("Admin access is required.");

      const [providerRows, verificationRows, jobRows, paymentRows, payoutRows] = await Promise.all([
        restGet<ProviderRow[]>(
          "providers?select=id,business_name,service_category,location,is_verified,is_available,created_at&order=created_at.desc",
          currentSession.access_token,
        ),
        restGet<VerificationRow[]>(
          "provider_verifications?select=id,provider_id,status,submitted_at&order=created_at.desc",
          currentSession.access_token,
        ),
        restGet<JobRow[]>(
          "jobs?select=id,service_category,location,status,payment_status,is_urgent,created_at&order=created_at.desc",
          currentSession.access_token,
        ),
        restGet<PaymentRow[]>(
          "payments?select=id,amount_naira,commission_amount_naira,provider_net_naira,status,is_test,created_at&order=created_at.desc",
          currentSession.access_token,
        ),
        restGet<PayoutRow[]>(
          "payout_requests?select=id,amount_naira,status,is_test,requested_at&order=requested_at.desc",
          currentSession.access_token,
        ),
      ]);

      setProviders(providerRows);
      setVerifications(verificationRows);
      setJobs(jobRows);
      setPayments(paymentRows);
      setPayouts(payoutRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the Rydah admin dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const liveProcessedPayments = useMemo(
    () => payments.filter((payment) => !payment.is_test && ["paid", "cash_due"].includes(payment.status)),
    [payments],
  );
  const sandboxProcessedPayments = useMemo(
    () => payments.filter((payment) => payment.is_test && ["paid", "cash_due"].includes(payment.status)),
    [payments],
  );

  const grossJobValue = useMemo(
    () => liveProcessedPayments.reduce((sum, row) => sum + Number(row.amount_naira || 0), 0),
    [liveProcessedPayments],
  );

  const rydahRevenue = useMemo(
    () => liveProcessedPayments.reduce((sum, row) => sum + Number(row.commission_amount_naira || 0), 0),
    [liveProcessedPayments],
  );

  const providerNet = useMemo(
    () => liveProcessedPayments.reduce((sum, row) => sum + Number(row.provider_net_naira || 0), 0),
    [liveProcessedPayments],
  );

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }, []);
  const monthlyLivePayments = useMemo(
    () => liveProcessedPayments.filter((payment) => new Date(payment.created_at).getTime() >= monthStart),
    [liveProcessedPayments, monthStart],
  );
  const monthlyGmv = useMemo(
    () => monthlyLivePayments.reduce((sum, row) => sum + Number(row.amount_naira || 0), 0),
    [monthlyLivePayments],
  );
  const monthlyRydahRevenue = useMemo(
    () => monthlyLivePayments.reduce((sum, row) => sum + Number(row.commission_amount_naira || 0), 0),
    [monthlyLivePayments],
  );
  const averageLiveJobValue = monthlyLivePayments.length > 0 ? Math.round(monthlyGmv / monthlyLivePayments.length) : 0;
  const monthlyGmvTarget = 5_000_000;
  const gmvProgress = Math.min(100, Math.round((monthlyGmv / monthlyGmvTarget) * 100));

  const pendingVerifications = verifications.filter((row) => row.status === "pending");
  const verifiedProviders = providers.filter((row) => row.is_verified);
  const availableVerifiedProviders = providers.filter((row) => row.is_verified && row.is_available);
  const citySupply = RYDAH_TARGET_CITIES.map((city) => ({
    city,
    count: availableVerifiedProviders.filter((provider) => cityFromServiceArea(provider.location) === city).length,
  }));
  const activeJobs = jobs.filter((row) => !["completed", "cancelled"].includes(row.status));
  const completedJobs = jobs.filter((row) => row.status === "completed");
  const pendingPayouts = payouts.filter((row) => !row.is_test && row.status === "pending");
  const paidPayouts = payouts.filter((row) => !row.is_test && row.status === "paid");
  const pendingPayoutAmount = pendingPayouts.reduce((sum, row) => sum + Number(row.amount_naira || 0), 0);
  const paidPayoutAmount = paidPayouts.reduce((sum, row) => sum + Number(row.amount_naira || 0), 0);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH ADMIN</p>
            <h1 className="mt-1 text-2xl font-black">Business Control Centre</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Verification</Link>
            <Link href="/admin/finance" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Finance</Link>
            <Link href="/payout-admin" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Payouts</Link>
            <Link href="/admin/safety" className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300">Safety</Link>
            <Link href="/admin/disputes" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Disputes</Link>
            <Link href="/admin/account-deletions" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Deletions</Link>
            <Link href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Marketplace</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">LIVE BUSINESS SUMMARY</p>
            <h2 className="mt-1 text-3xl font-black sm:text-4xl">Rydah at a glance</h2>
            <p className="mt-2 max-w-2xl text-zinc-400">Jobs, providers, commission revenue, verification and payouts in one place.</p>
          </div>
          <button
            type="button"
            onClick={() => session && void load(session)}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300"
          >
            Refresh Dashboard
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading Rydah business data...</div>
        ) : error ? (
          <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-950/20 p-5 sm:p-6 text-red-300">{error}</div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Total jobs</p>
                <p className="mt-2 text-4xl font-black">{jobs.length}</p>
                <p className="mt-2 text-xs text-zinc-500">{activeJobs.length} active • {completedJobs.length} completed</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Providers</p>
                <p className="mt-2 text-4xl font-black">{providers.length}</p>
                <p className="mt-2 text-xs text-emerald-400">{verifiedProviders.length} verified</p>
              </div>
              <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Live Rydah revenue</p>
                <p className="mt-2 text-4xl font-black text-[#D4AF37]">{naira(rydahRevenue)}</p>
                <p className="mt-2 text-xs text-zinc-500">Real processed payments only • sandbox excluded</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Live processed payments</p>
                <p className="mt-2 text-4xl font-black">{liveProcessedPayments.length}</p>
                <p className="mt-2 text-xs text-zinc-500">Live GMV {naira(grossJobValue)} • {sandboxProcessedPayments.length} sandbox excluded</p>
              </div>
            </div>

            <section className="mt-6 rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#17130a] to-[#101010] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">₦5M MONTHLY TURNOVER TARGET</p>
                  <h3 className="mt-1 text-2xl font-black">Live marketplace progress</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Only non-test processed jobs count here, so sandbox activity can never make launch performance look better than it really is.</p>
                </div>
                <span className="rounded-full bg-[#D4AF37]/15 px-4 py-2 text-sm font-black text-[#D4AF37]">{gmvProgress}% of target</span>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#D4AF37]" style={{ width: `${gmvProgress}%` }} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-zinc-500">This month live GMV</p><p className="mt-1 text-2xl font-black">{naira(monthlyGmv)}</p></div>
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-zinc-500">This month Rydah revenue</p><p className="mt-1 text-2xl font-black text-[#D4AF37]">{naira(monthlyRydahRevenue)}</p></div>
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-zinc-500">Live paid/cash-due jobs</p><p className="mt-1 text-2xl font-black">{monthlyLivePayments.length}</p></div>
                <div className="rounded-2xl bg-black/25 p-4"><p className="text-xs text-zinc-500">Average live job value</p><p className="mt-1 text-2xl font-black">{naira(averageLiveJobValue)}</p></div>
              </div>
              <div className="mt-5">
                <p className="text-xs font-black tracking-[0.14em] text-zinc-500">AVAILABLE VERIFIED PROVIDERS BY CITY</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {citySupply.map((item) => (
                    <div key={item.city} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                      <p className="text-sm font-bold">{item.city}</p>
                      <p className="mt-1 text-xl font-black text-emerald-400">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/providers" className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6 transition hover:border-[#D4AF37]/50">
                <p className="text-sm text-zinc-500">Pending verification</p>
                <p className="mt-2 text-4xl font-black text-[#D4AF37]">{pendingVerifications.length}</p>
                <p className="mt-3 text-sm font-bold text-[#D4AF37]">Review providers →</p>
              </Link>
              <Link href="/payout-admin" className="rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6 transition hover:border-[#D4AF37]/50">
                <p className="text-sm text-zinc-500">Pending payouts</p>
                <p className="mt-2 text-4xl font-black">{pendingPayouts.length}</p>
                <p className="mt-1 text-lg font-black text-[#D4AF37]">{naira(pendingPayoutAmount)}</p>
                <p className="mt-3 text-sm font-bold text-[#D4AF37]">Open payout queue →</p>
              </Link>
              <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Completed payouts</p>
                <p className="mt-2 text-4xl font-black text-emerald-400">{paidPayouts.length}</p>
                <p className="mt-1 text-lg font-black text-emerald-400">{naira(paidPayoutAmount)}</p>
              </div>
              <div className="rounded-3xl border border-emerald-500/20 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Provider net earnings</p>
                <p className="mt-2 text-4xl font-black text-emerald-400">{naira(providerNet)}</p>
                <p className="mt-2 text-xs text-zinc-500">After Rydah commission</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">RECENT JOBS</p>
                    <h3 className="mt-1 text-2xl font-black">Latest requests</h3>
                  </div>
                  <Link href="/providers" className="text-sm font-bold text-zinc-400">Marketplace</Link>
                </div>
                <div className="mt-5 grid gap-3">
                  {jobs.length === 0 ? (
                    <p className="text-zinc-500">No jobs have been posted yet.</p>
                  ) : jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="rounded-2xl bg-[#1A1A1A] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{job.service_category}{job.is_urgent ? " • URGENT" : ""}</p>
                          <p className="mt-1 text-sm text-zinc-400">{displayServiceArea(job.location)}</p>
                        </div>
                        <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-black text-[#D4AF37]">{label(job.status)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm font-black tracking-[0.16em] text-[#D4AF37]">ADMIN SHORTCUTS</p>
                <h3 className="mt-1 text-2xl font-black">Run Rydah</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href="/admin/providers" className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5"><p className="font-black">Provider Verification</p><p className="mt-1 text-sm text-zinc-500">Approve trusted professionals.</p></Link>
                  <Link href="/admin/finance" className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5"><p className="font-black">Finance & Commission</p><p className="mt-1 text-sm text-zinc-500">Revenue, ledger and commission rate.</p></Link>
                  <Link href="/payout-admin" className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5"><p className="font-black">Provider Payouts</p><p className="mt-1 text-sm text-zinc-500">Review and settle withdrawal requests.</p></Link>
                  <Link href="/notifications" className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5"><p className="font-black">Notifications</p><p className="mt-1 text-sm text-zinc-500">See verification and job updates.</p></Link>
                  <Link href="/admin/safety" className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5"><p className="font-black text-red-200">Safety Review</p><p className="mt-1 text-sm text-zinc-500">Review job-linked safety reports and urgent concerns.</p></Link>
                  <Link href="/admin/disputes" className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5"><p className="font-black text-[#E5C65A]">Disputes & Refunds</p><p className="mt-1 text-sm text-zinc-500">Review complaints and controlled refund requests.</p></Link>
                  <Link href="/admin/account-deletions" className="rounded-2xl border border-white/10 bg-[#1A1A1A] p-5"><p className="font-black">Account Deletions</p><p className="mt-1 text-sm text-zinc-500">Complete anonymisation and deletion requests.</p></Link>
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
