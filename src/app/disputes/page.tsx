"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { resolveUserAccess, type RydahRole } from "@/lib/access";
import {
  getStoredSession,
  restGet,
  restInsertMinimal,
  restRpc,
  type AuthSession,
} from "@/lib/supabase";
import BrandLogo from "../brand-logo";

type JobRow = {
  id: string;
  service_category: string;
  location: string;
  status: string;
  created_at: string;
};

type PaymentRow = {
  id: string;
  job_id: string;
  amount_naira: number;
  status: string;
  reference: string;
  method: string;
  gateway: string;
  refund_status: string;
};

type DisputeRow = {
  id: string;
  job_id: string;
  payment_id: string | null;
  category: string;
  description: string;
  requested_refund_amount_naira: number | null;
  status: string;
  resolution_message: string | null;
  created_at: string;
};

const categories = [
  ["service_not_delivered", "Service not delivered"],
  ["service_quality", "Service quality"],
  ["wrong_amount", "Wrong amount"],
  ["duplicate_charge", "Duplicate charge"],
  ["unauthorised_payment", "Unauthorised payment"],
  ["cash_issue", "Cash payment issue"],
  ["other", "Other"],
] as const;

function naira(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG")}`;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "refunded" || status === "resolved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "rejected") return "bg-zinc-500/15 text-zinc-300";
  if (status === "refund_pending") return "bg-blue-500/15 text-blue-300";
  if (status === "in_review") return "bg-amber-500/15 text-amber-200";
  return "bg-red-500/15 text-red-200";
}

export default function DisputesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [role, setRole] = useState<Exclude<RydahRole, "admin">>("customer");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [jobId, setJobId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number][0]>("service_not_delivered");
  const [description, setDescription] = useState("");
  const [requestFullRefund, setRequestFullRefund] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const jobPayments = useMemo(
    () => payments.filter((payment) => payment.job_id === jobId),
    [payments, jobId],
  );

  const selectedPayment = useMemo(
    () => payments.find((payment) => payment.id === paymentId) ?? null,
    [payments, paymentId],
  );

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fdisputes");
      return;
    }
    setSession(current);
    void initialise(current);
  // Intentional one-time browser auth/data bootstrap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paymentId && !jobPayments.some((payment) => payment.id === paymentId)) {
      setPaymentId("");
      setRequestFullRefund(false);
    }
  }, [jobId, jobPayments, paymentId]);

  async function initialise(current: AuthSession) {
    setLoading(true);
    setError("");

    try {
      const access = await resolveUserAccess(current);
      if (access.role === "admin") {
        window.location.assign("/admin/disputes");
        return;
      }
      setRole(access.role);

      const [jobRows, paymentRows, disputeRows] = await Promise.all([
        access.role === "provider"
          ? restRpc<JobRow[]>("provider_job_feed", {}, current.access_token)
          : restGet<JobRow[]>(
              `jobs?select=id,service_category,location,status,created_at&customer_id=eq.${current.user.id}&order=created_at.desc&limit=100`,
              current.access_token,
            ),
        restGet<PaymentRow[]>(
          "payments?select=id,job_id,amount_naira,status,reference,method,gateway,refund_status&order=created_at.desc&limit=100",
          current.access_token,
        ),
        restGet<DisputeRow[]>(
          "payment_disputes?select=id,job_id,payment_id,category,description,requested_refund_amount_naira,status,resolution_message,created_at&order=created_at.desc&limit=100",
          current.access_token,
        ),
      ]);

      const normalizedJobs = Array.isArray(jobRows) ? jobRows : [];
      setJobs(normalizedJobs);
      setPayments(paymentRows);
      setDisputes(disputeRows);
      if (!jobId && normalizedJobs[0]?.id) setJobId(normalizedJobs[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load disputes.");
    } finally {
      setLoading(false);
    }
  }

  async function submitDispute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const cleanDescription = description.trim();
    if (!jobId) {
      setError("Choose the related job.");
      return;
    }
    if (cleanDescription.length < 10) {
      setError("Please give a little more detail about the problem.");
      return;
    }
    if (requestFullRefund && !selectedPayment) {
      setError("Choose the payment you want Rydah to review for a refund.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await restInsertMinimal(
        "payment_disputes",
        {
          job_id: jobId,
          payment_id: paymentId || null,
          reporter_user_id: session.user.id,
          reporter_role: role,
          category,
          description: cleanDescription,
          requested_refund_amount_naira: requestFullRefund && selectedPayment
            ? selectedPayment.amount_naira
            : null,
          status: "open",
        },
        session.access_token,
      );

      setDescription("");
      setRequestFullRefund(false);
      setMessage("Your dispute has been submitted to Rydah for review.");
      await initialise(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the dispute.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-6 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/"><BrandLogo /></Link>
          <a href={role === "provider" ? "/provider-work" : "/my-jobs"} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">
            Back to jobs
          </a>
        </div>

        <div className="mt-6 rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-6">
          <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">RYDAH RESOLUTION CENTRE</p>
          <h1 className="mt-2 text-3xl font-black">Disputes & refunds</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Report a service or payment problem. Refund requests are reviewed by Rydah; submitting a dispute never moves money automatically.
          </p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading resolution centre…</div>
        ) : (
          <>
            <form onSubmit={submitDispute} className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <h2 className="text-2xl font-black">Open a dispute</h2>

              <label className="mt-5 block text-sm font-bold">
                Related job
                <select
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                >
                  {jobs.length === 0 && <option value="">No Rydah jobs available</option>}
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.service_category} — {job.location} — {label(job.status)} — {job.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-5 block text-sm font-bold">
                Payment, if relevant
                <select
                  value={paymentId}
                  onChange={(event) => setPaymentId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                >
                  <option value="">No payment selected</option>
                  {jobPayments.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {naira(payment.amount_naira)} — {label(payment.status)} — {payment.reference}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-5 block text-sm font-bold">
                Problem type
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as typeof category)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                >
                  {categories.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                </select>
              </label>

              <label className="mt-5 block text-sm font-bold">
                What happened?
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={6}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 font-normal outline-none placeholder:text-zinc-600"
                  placeholder="Describe the service or payment problem and what outcome you are asking Rydah to review."
                />
              </label>

              {selectedPayment?.status === "paid" && selectedPayment.gateway !== "cash" && (
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={requestFullRefund}
                    onChange={(event) => setRequestFullRefund(event.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#D4AF37]"
                  />
                  <span>
                    Request a full refund review for {naira(selectedPayment.amount_naira)}. Rydah admin approval is required before any Paystack refund is initiated.
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting || !jobId || description.trim().length < 10}
                className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit Dispute"}
              </button>
            </form>

            <section className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <h2 className="text-2xl font-black">Your disputes</h2>
              {disputes.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">You have not opened a dispute.</p>
              ) : (
                <div className="mt-5 grid gap-4">
                  {disputes.map((row) => (
                    <article key={row.id} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{label(row.category)}</p>
                          <p className="mt-1 text-xs text-zinc-500">Job {row.job_id.slice(0, 8)} • {new Date(row.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(row.status)}`}>{label(row.status)}</span>
                      </div>
                      {row.requested_refund_amount_naira && (
                        <p className="mt-3 text-sm font-bold text-[#E5C65A]">Full refund requested: {naira(row.requested_refund_amount_naira)}</p>
                      )}
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{row.description}</p>
                      {row.resolution_message && (
                        <div className="mt-4 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 text-sm leading-6 text-zinc-300">
                          <p className="font-black text-[#D4AF37]">Rydah update</p>
                          <p className="mt-1">{row.resolution_message}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
