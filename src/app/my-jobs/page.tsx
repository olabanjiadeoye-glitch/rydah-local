"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restInsert, type AuthSession } from "@/lib/supabase";

type JobStatus = "open" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  description: string;
  is_urgent: boolean;
  status: JobStatus;
  created_at: string;
  quoted_amount: number | null;
  payment_status: "unpaid" | "pending" | "paid" | "cash_due" | "failed" | "refunded";
  providers: { business_name: string; starting_price: number | null } | null;
};

type ReviewRow = {
  id: string;
  job_id: string;
  rating: number;
  comment: string | null;
};

function label(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: JobStatus) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-400";
  if (status === "cancelled") return "bg-red-500/15 text-red-300";
  if (status === "in_progress") return "bg-blue-500/15 text-blue-300";
  return "bg-[#D4AF37]/15 text-[#D4AF37]";
}

function paymentStyle(status: JobRow["payment_status"]) {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-400";
  if (status === "failed") return "bg-red-500/15 text-red-300";
  return "bg-[#D4AF37]/15 text-[#D4AF37]";
}

export default function MyJobsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const reviewByJob = useMemo(() => new Map(reviews.map((review) => [review.job_id, review])), [reviews]);

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }
    setSession(currentSession);
    void loadData(currentSession);
  }, []);

  async function loadData(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const [jobRows, reviewRows] = await Promise.all([
        restGet<JobRow[]>(
          `jobs?select=id,provider_id,service_category,location,description,is_urgent,status,created_at,quoted_amount,payment_status,providers(business_name,starting_price)&customer_id=eq.${currentSession.user.id}&order=created_at.desc`,
          currentSession.access_token,
        ),
        restGet<ReviewRow[]>(
          `reviews?select=id,job_id,rating,comment&customer_id=eq.${currentSession.user.id}`,
          currentSession.access_token,
        ),
      ]);
      setJobs(jobRows);
      setReviews(reviewRows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your jobs.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>, job: JobRow) {
    event.preventDefault();
    if (!session || !job.provider_id) return;

    const rating = ratings[job.id] ?? 0;
    if (rating < 1 || rating > 5) {
      setError("Choose a star rating from 1 to 5.");
      return;
    }

    setSavingJobId(job.id);
    setError("");
    setMessage("");

    try {
      const created = await restInsert<ReviewRow[]>(
        "reviews",
        {
          job_id: job.id,
          customer_id: session.user.id,
          provider_id: job.provider_id,
          rating,
          comment: comments[job.id]?.trim() || null,
        },
        session.access_token,
      );
      if (created[0]) setReviews((current) => [...current, created[0]]);
      setMessage("Thanks — your rating has been saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your rating.");
    } finally {
      setSavingJobId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">My Jobs</h1>
          </div>
          <div className="flex gap-2">
            <a href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Providers</a>
            <a href="/post-job" className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">Post Job</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">CUSTOMER DASHBOARD</p>
            <h2 className="mt-1 text-3xl font-black">Track your requests</h2>
            <p className="mt-2 text-zinc-400">See provider progress, manage payment and rate completed work.</p>
          </div>
          <button
            type="button"
            onClick={() => session && void loadData(session)}
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300"
          >
            Refresh Status
          </button>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading your jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-[#121212] p-8 text-center">
            <h3 className="text-2xl font-black">No jobs yet</h3>
            <p className="mt-2 text-zinc-400">Post your first request and track it here.</p>
            <a href="/post-job" className="mt-5 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Post a Job</a>
          </div>
        ) : (
          <div className="mt-8 grid gap-5">
            {jobs.map((job) => {
              const review = reviewByJob.get(job.id);
              const providerName = job.providers?.business_name || (job.provider_id ? "Assigned provider" : "Matching in progress");
              const amount = job.quoted_amount ?? job.providers?.starting_price ?? null;

              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black">{job.service_category}</h3>
                        {job.is_urgent && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                      </div>
                      <p className="mt-2 text-zinc-400">{job.location}</p>
                      <p className="mt-4 text-zinc-300">{job.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${statusStyle(job.status)}`}>{label(job.status)}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#1A1A1A] p-4">
                      <p className="text-xs text-zinc-500">Provider</p>
                      <p className="mt-1 font-bold">{providerName}</p>
                    </div>
                    <div className="rounded-2xl bg-[#1A1A1A] p-4">
                      <p className="text-xs text-zinc-500">Requested</p>
                      <p className="mt-1 font-bold">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl bg-[#1A1A1A] p-4">
                      <p className="text-xs text-zinc-500">Request ID</p>
                      <p className="mt-1 font-bold">{job.id.slice(0, 8)}</p>
                    </div>
                  </div>

                  {job.status === "completed" && job.provider_id && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-[#D4AF37]">PAYMENT</p>
                          <p className="mt-1 text-2xl font-black">{amount == null ? "Amount not set" : `₦${amount.toLocaleString()}`}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-2 text-xs font-black ${paymentStyle(job.payment_status)}`}>{label(job.payment_status)}</span>
                          <a href={`/payments?job=${job.id}`} className="rounded-2xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black">
                            {job.payment_status === "paid" ? "View Payment" : "Pay / Test"}
                          </a>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">Payments are currently in sandbox mode for testing. No real money is charged.</p>
                    </div>
                  )}

                  {job.status === "completed" && job.provider_id && (
                    <div className="mt-5 rounded-2xl border border-[#D4AF37]/20 bg-[#0D0D0D] p-5">
                      {review ? (
                        <div>
                          <p className="text-sm font-black text-[#D4AF37]">YOUR REVIEW</p>
                          <p className="mt-2 text-xl">{"★".repeat(review.rating)}<span className="text-zinc-700">{"★".repeat(5 - review.rating)}</span></p>
                          {review.comment && <p className="mt-3 text-zinc-300">{review.comment}</p>}
                        </div>
                      ) : (
                        <form onSubmit={(event) => void submitReview(event, job)}>
                          <p className="text-sm font-black text-[#D4AF37]">RATE THIS JOB</p>
                          <p className="mt-2 text-zinc-400">How was your experience with {providerName}?</p>

                          <div className="mt-4 flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatings((current) => ({ ...current, [job.id]: star }))}
                                className={`text-3xl ${star <= (ratings[job.id] ?? 0) ? "text-[#D4AF37]" : "text-zinc-700"}`}
                                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                              >
                                ★
                              </button>
                            ))}
                          </div>

                          <textarea
                            value={comments[job.id] ?? ""}
                            onChange={(event) => setComments((current) => ({ ...current, [job.id]: event.target.value }))}
                            maxLength={1000}
                            placeholder="Optional comment about the service"
                            className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
                          />

                          <button
                            disabled={savingJobId === job.id}
                            className="mt-4 rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black disabled:opacity-60"
                          >
                            {savingJobId === job.id ? "Saving..." : "Submit Rating"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
