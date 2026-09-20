"use client";

import { displayServiceArea } from "@/lib/locations";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restInsert, restPatch, restRpc, type AuthSession } from "@/lib/supabase";

type JobStatus = "open" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled";
type QuoteStatus = "not_sent" | "pending" | "accepted" | "rejected";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  landmark_text: string | null;
  description: string;
  is_urgent: boolean;
  status: JobStatus;
  created_at: string;
  quoted_amount: number | null;
  quote_status: QuoteStatus;
  quote_accepted_at: string | null;
  payment_status: "unpaid" | "pending" | "paid" | "cash_due" | "failed" | "refunded";
  arrival_verified_at: string | null;
  arrival_face_verified_at: string | null;
  providers: { business_name: string; starting_price: number | null; is_verified: boolean; biometric_verified: boolean } | null;
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
  const [arrivalPins, setArrivalPins] = useState<Record<string, string>>({});

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
          `jobs?select=id,provider_id,service_category,location,landmark_text,description,is_urgent,status,created_at,quoted_amount,quote_status,quote_accepted_at,payment_status,arrival_verified_at,arrival_face_verified_at,providers(business_name,starting_price,is_verified,biometric_verified)&customer_id=eq.${currentSession.user.id}&order=created_at.desc`,
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

  async function respondToQuote(job: JobRow, decision: "accepted" | "rejected") {
    if (!session) return;
    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<JobRow[]>(
        "jobs",
        `id=eq.${job.id}`,
        { quote_status: decision },
        session.access_token,
      );
      if (!updated[0]) throw new Error("The quote response was not returned.");
      setJobs((current) => current.map((item) => (
        item.id === job.id ? { ...item, ...updated[0], providers: item.providers } : item
      )));
      setMessage(decision === "accepted" ? "Quote accepted. When the provider arrives, generate the Arrival PIN before work starts." : "Quote rejected. The provider can send you a revised quote.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to respond to the quote.");
    } finally {
      setSavingJobId("");
    }
  }

  async function issueArrivalPin(job: JobRow) {
    if (!session) return;
    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      const pin = await restRpc<string>("issue_arrival_code", { p_job_id: job.id }, session.access_token);
      setArrivalPins((current) => ({ ...current, [job.id]: pin }));
      setMessage("Arrival PIN generated. Only give it to the provider who is physically with you. It expires in 30 minutes.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate the arrival PIN.");
    } finally {
      setSavingJobId("");
    }
  }

  async function cancelJob(job: JobRow) {
    if (!session) return;
    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<JobRow[]>(
        "jobs",
        `id=eq.${job.id}`,
        { status: "cancelled" },
        session.access_token,
      );
      if (!updated[0]) throw new Error("The cancellation was not returned.");
      setJobs((current) => current.map((item) => (
        item.id === job.id ? { ...item, ...updated[0], providers: item.providers } : item
      )));
      setMessage("Job cancelled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel this job.");
    } finally {
      setSavingJobId("");
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
            <Link href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Providers</Link>
            <Link href="/post-job" className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black">Post Job</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">CUSTOMER DASHBOARD</p>
            <h2 className="mt-1 text-3xl font-black">Track your requests</h2>
            <p className="mt-2 text-zinc-400">Review quotes, verify provider arrival, follow progress and pay completed jobs.</p>
          </div>
          <button type="button" onClick={() => session && void loadData(session)} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300">Refresh Status</button>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading your jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-center">
            <h3 className="text-2xl font-black">No jobs yet</h3>
            <p className="mt-2 text-zinc-400">Post your first request and track it here.</p>
            <Link href="/post-job" className="mt-5 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Post a Job</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {jobs.map((job) => {
              const review = reviewByJob.get(job.id);
              const providerName = job.providers?.business_name || (job.provider_id ? "Assigned provider" : "Matching in progress");
              const amount = job.quoted_amount ?? null;
              const busy = savingJobId === job.id;
              const canCancel = ["open", "matched", "accepted"].includes(job.status);
              const arrivalPin = arrivalPins[job.id] || "";

              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black">{job.service_category}</h3>
                        {job.is_urgent && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                        {job.providers?.biometric_verified ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">✓ BIOMETRIC VERIFIED</span>
                        ) : job.providers?.is_verified ? (
                          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-300">ID REVIEWED • BIOMETRIC REQUIRED</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-zinc-400">{displayServiceArea(job.location)}</p>
                      {job.landmark_text && <p className="mt-1 text-sm text-zinc-500">📍 Landmark: {job.landmark_text}</p>}
                      <p className="mt-4 text-zinc-300">{job.description}</p>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${statusStyle(job.status)}`}>{label(job.status)}</span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Provider</p><p className="mt-1 font-bold">{providerName}</p></div>
                    <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Requested</p><p className="mt-1 font-bold">{new Date(job.created_at).toLocaleString()}</p></div>
                    <div className="rounded-2xl bg-[#1A1A1A] p-4"><p className="text-xs text-zinc-500">Request ID</p><p className="mt-1 font-bold">{job.id.slice(0, 8)}</p></div>
                  </div>

                  {job.quoted_amount != null && job.quote_status !== "not_sent" && (
                    <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-[#D4AF37]">PROVIDER QUOTE</p>
                          <p className="mt-1 text-3xl font-black">₦{job.quoted_amount.toLocaleString()}</p>
                          <p className="mt-2 text-sm text-zinc-400">Status: <span className="font-black text-white">{label(job.quote_status)}</span></p>
                        </div>
                        {job.quote_status === "pending" && (
                          <div className="flex gap-2">
                            <button disabled={busy} onClick={() => void respondToQuote(job, "accepted")} className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">Accept Quote</button>
                            <button disabled={busy} onClick={() => void respondToQuote(job, "rejected")} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black disabled:opacity-50">Reject</button>
                          </div>
                        )}
                      </div>
                      {job.quote_status === "pending" && (
                        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                          Check the amount before accepting. If the work changes later, ask the provider to send a revised quote in Rydah instead of agreeing a different price by phone, WhatsApp or cash.
                        </div>
                      )}
                      {job.quote_status === "accepted" && <p className="mt-3 text-sm text-emerald-300">Quote accepted. This is the agreed job price in Rydah. Verify the provider on arrival before work begins and keep payment inside Rydah.</p>}
                      {job.quote_status === "rejected" && <p className="mt-3 text-sm text-amber-300">Quote rejected. Wait for the provider to send a revised amount.</p>}
                    </div>
                  )}

                  {job.status === "accepted" && job.quote_status === "accepted" && job.provider_id && (
                    <div className={`mt-5 rounded-2xl border p-5 ${job.arrival_verified_at ? "border-emerald-500/25 bg-emerald-500/10" : "border-[#D4AF37]/25 bg-[#D4AF37]/5"}`}>
                      <p className={`text-sm font-black ${job.arrival_verified_at ? "text-emerald-400" : "text-[#D4AF37]"}`}>PROVIDER ARRIVAL SAFETY CHECK</p>
                      {job.arrival_face_verified_at ? (
                        <>
                          <p className="mt-2 text-xl font-black text-emerald-300">✓ Arrival safety checks complete</p>
                          <p className="mt-2 text-sm text-zinc-300">The Arrival PIN and customer camera face match have both passed. The assigned provider can now start the job.</p>
                        </>
                      ) : job.arrival_verified_at ? (
                        <>
                          <p className="mt-2 text-xl font-black text-emerald-300">✓ Arrival PIN verified</p>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">One more safety step is required before work can begin: use your phone camera to verify the provider&apos;s face against their biometrically verified Rydah identity.</p>
                          <Link href="/arrival-check" className="mt-4 inline-flex rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black">Continue to Camera Verification</Link>
                        </>
                      ) : (
                        <>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">Wait until the provider is physically with you, then generate a one-time 6-digit PIN. Do not share it by phone or message before they arrive.</p>
                          <button disabled={busy} onClick={() => void issueArrivalPin(job)} className="mt-4 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">{arrivalPin ? "Generate New PIN" : "Generate Arrival PIN"}</button>
                          {arrivalPin && (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
                              <p className="text-xs font-black tracking-[0.2em] text-zinc-500">TELL THE PROVIDER THIS PIN</p>
                              <p className="mt-2 text-4xl font-black tracking-[0.25em] text-[#D4AF37]">{arrivalPin}</p>
                              <p className="mt-3 text-xs text-zinc-500">Expires in 30 minutes. A new PIN invalidates the previous one.</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {canCancel && (
                    <div className="mt-5">
                      <button disabled={busy} onClick={() => void cancelJob(job)} className="rounded-xl border border-red-500/20 px-4 py-3 text-sm font-bold text-red-300 disabled:opacity-50">Cancel Job</button>
                    </div>
                  )}

                  {job.status === "completed" && job.provider_id && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black text-[#D4AF37]">PAYMENT</p>
                          <p className="mt-1 text-2xl font-black">{amount == null ? "Amount not set" : `₦${amount.toLocaleString()}`}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-2 text-xs font-black ${paymentStyle(job.payment_status)}`}>{label(job.payment_status)}</span>
                          <Link href={`/payments?job=${job.id}`} className="rounded-2xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black">{["paid", "cash_due"].includes(job.payment_status) ? "View Payment" : "Pay Securely"}</Link>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">Online checkout is handled securely by Paystack. Only pay after you are satisfied the job is complete.</p>
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
                              <button key={star} type="button" onClick={() => setRatings((current) => ({ ...current, [job.id]: star }))} className={`text-3xl ${star <= (ratings[job.id] ?? 0) ? "text-[#D4AF37]" : "text-zinc-700"}`} aria-label={`${star} star${star === 1 ? "" : "s"}`}>★</button>
                            ))}
                          </div>
                          <textarea value={comments[job.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [job.id]: event.target.value }))} maxLength={1000} placeholder="Optional comment about the service" className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
                          <button disabled={busy} className="mt-4 rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black disabled:opacity-60">{busy ? "Saving..." : "Submit Rating"}</button>
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
