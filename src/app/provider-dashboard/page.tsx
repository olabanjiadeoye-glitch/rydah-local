"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clearSession,
  getStoredSession,
  restGet,
  restInsert,
  restPatch,
  type AuthSession,
} from "@/lib/supabase";

type ProviderRow = {
  id: string;
  user_id: string | null;
  business_name: string;
  service_category: string;
  location: string;
  description: string | null;
  rating: number | string;
  jobs_completed: number;
  starting_price: number | null;
  is_verified: boolean;
  is_available: boolean;
};

type JobStatus = "open" | "matched" | "accepted" | "in_progress" | "completed" | "cancelled";
type QuoteStatus = "not_sent" | "pending" | "accepted" | "rejected";

type JobRow = {
  id: string;
  provider_id: string | null;
  service_category: string;
  location: string;
  description: string;
  is_urgent: boolean;
  status: JobStatus;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  quoted_amount: number | null;
  quote_status: QuoteStatus;
  quote_accepted_at: string | null;
  payment_status: string;
};

const categories = ["Electrician", "Plumber", "AC Technician", "Generator", "Cleaning", "Mechanic"];
const locations = ["Lekki, Lagos", "Victoria Island, Lagos", "Ikeja, Lagos"];

function naira(value: number | null) {
  return value == null ? "Not set" : `₦${Number(value).toLocaleString()}`;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ProviderDashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingJobId, setSavingJobId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, string>>({});

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Electrician");
  const [location, setLocation] = useState("Lekki, Lagos");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");

  const openJobs = useMemo(
    () => jobs.filter((job) => !["completed", "cancelled"].includes(job.status)).length,
    [jobs],
  );

  useEffect(() => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      window.location.href = "/sign-in";
      return;
    }
    setSession(currentSession);
    void loadDashboard(currentSession);
  }, []);

  async function loadDashboard(currentSession: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const providerRows = await restGet<ProviderRow[]>(
        `providers?user_id=eq.${currentSession.user.id}&select=*`,
        currentSession.access_token,
      );
      const currentProvider = providerRows[0] ?? null;
      setProvider(currentProvider);

      if (!currentProvider) {
        setJobs([]);
        return;
      }

      const jobRows = await restGet<JobRow[]>(
        `jobs?provider_id=eq.${currentProvider.id}&select=*&order=created_at.desc`,
        currentSession.access_token,
      );
      setJobs(jobRows);
      setQuoteDrafts(Object.fromEntries(jobRows.map((job) => [job.id, job.quoted_amount ? String(job.quoted_amount) : ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load provider dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function createProviderProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const created = await restInsert<ProviderRow[]>(
        "providers",
        {
          user_id: session.user.id,
          business_name: businessName.trim(),
          service_category: category,
          location,
          description: description.trim(),
          starting_price: Number(startingPrice),
          is_available: true,
          is_verified: false,
        },
        session.access_token,
      );
      if (!created[0]) throw new Error("Provider profile was not returned by the backend.");
      setProvider(created[0]);
      setJobs([]);
      setMessage("Provider profile created. Complete verification before taking jobs.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create provider profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function toggleAvailability() {
    if (!session || !provider) return;
    setSavingProfile(true);
    setError("");
    try {
      const updated = await restPatch<ProviderRow[]>(
        "providers",
        `id=eq.${provider.id}`,
        { is_available: !provider.is_available },
        session.access_token,
      );
      if (updated[0]) setProvider(updated[0]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change availability.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function updateJobStatus(job: JobRow, status: JobStatus) {
    if (!session) return;
    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<JobRow[]>(
        "jobs",
        `id=eq.${job.id}`,
        { status },
        session.access_token,
      );
      if (!updated[0]) throw new Error("The updated job was not returned.");
      setJobs((current) => current.map((item) => (item.id === job.id ? updated[0] : item)));
      setMessage(`Job marked as ${label(status)}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update job.");
    } finally {
      setSavingJobId("");
    }
  }

  async function sendQuote(job: JobRow) {
    if (!session) return;
    const amount = Number(quoteDrafts[job.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid quote greater than ₦0.");
      return;
    }

    setSavingJobId(job.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<JobRow[]>(
        "jobs",
        `id=eq.${job.id}`,
        { quoted_amount: Math.round(amount) },
        session.access_token,
      );
      if (!updated[0]) throw new Error("The quote update was not returned.");
      setJobs((current) => current.map((item) => (item.id === job.id ? updated[0] : item)));
      setQuoteDrafts((current) => ({ ...current, [job.id]: String(updated[0].quoted_amount ?? amount) }));
      setMessage(`Quote of ${naira(updated[0].quoted_amount ?? amount)} sent to the customer.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send quote.");
    } finally {
      setSavingJobId("");
    }
  }

  function signOut() {
    clearSession();
    window.location.href = "/";
  }

  if (loading) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Loading provider dashboard...</main>;
  }

  const role = session?.user.user_metadata?.role;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Provider Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <a href="/providers" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Marketplace</a>
            <button onClick={signOut} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Sign Out</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10">
        {message && <div className="mb-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {role !== "provider" && !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
            <h2 className="text-2xl font-black">This is a customer account</h2>
            <p className="mt-3 text-zinc-400">Use a provider account to access this dashboard.</p>
            <a href="/providers" className="mt-6 inline-block rounded-2xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Browse Providers</a>
          </div>
        ) : !provider ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
            <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">WELCOME TO RYDAH</p>
            <h2 className="mt-2 text-3xl font-black">Set up your provider profile</h2>
            <form onSubmit={createProviderProfile} className="mt-7 grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm font-bold">Business name</span>
                <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Service category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">{categories.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="block">
                <span className="text-sm font-bold">Location</span>
                <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">{locations.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label className="block">
                <span className="text-sm font-bold">Starting price (₦)</span>
                <input required min="1" type="number" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-bold">About your service</span>
                <textarea required minLength={20} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </label>
              <button disabled={savingProfile} className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">Create Provider Profile</button>
            </form>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{provider.business_name}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${provider.is_verified ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>{provider.is_verified ? "✓ VERIFIED" : "VERIFICATION PENDING"}</span>
                    </div>
                    <p className="mt-2 text-zinc-400">{provider.service_category} • {provider.location}</p>
                    {provider.description && <p className="mt-4 text-sm leading-6 text-zinc-400">{provider.description}</p>}
                  </div>
                  <button disabled={savingProfile} onClick={() => void toggleAvailability()} className={`rounded-2xl px-5 py-3 text-sm font-black ${provider.is_available ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>{provider.is_available ? "● Available now" : "○ Offline"}</button>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                <p className="text-sm text-zinc-500">Starting price</p>
                <p className="mt-2 text-3xl font-black text-[#D4AF37]">{naira(provider.starting_price)}</p>
                <p className="mt-4 text-sm text-zinc-500">Active jobs: <span className="font-black text-white">{openJobs}</span></p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-sm font-black tracking-[0.18em] text-[#D4AF37]">CUSTOMER REQUESTS</p>
              <h2 className="mt-1 text-3xl font-black">Jobs assigned to you</h2>

              {jobs.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">No assigned jobs yet.</div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {jobs.map((job) => {
                    const busy = savingJobId === job.id;
                    const quoteEditable = ["open", "matched", "accepted"].includes(job.status) && job.payment_status !== "paid";
                    const canStart = job.status === "accepted" && job.quote_status === "accepted";
                    return (
                      <article key={job.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-black">{job.service_category}</h3>
                              {job.is_urgent && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                              <span className="rounded-full bg-[#D4AF37]/10 px-3 py-1 text-xs font-black text-[#D4AF37]">{label(job.status)}</span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-500">{job.location} • {new Date(job.created_at).toLocaleString()}</p>
                          </div>
                        </div>

                        <p className="mt-4 leading-7 text-zinc-300">{job.description}</p>

                        <div className="mt-5 grid gap-3 rounded-2xl bg-[#1A1A1A] p-4 text-sm sm:grid-cols-3">
                          <div><p className="text-zinc-500">Customer</p><p className="mt-1 font-bold">{job.contact_name || "Not provided"}</p></div>
                          <div><p className="text-zinc-500">Phone</p><p className="mt-1 font-bold">{job.contact_phone || "Not provided"}</p></div>
                          <div><p className="text-zinc-500">Email</p><p className="mt-1 break-all font-bold">{job.contact_email || "Not provided"}</p></div>
                        </div>

                        {quoteEditable && (
                          <div className="mt-5 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="min-w-0 flex-1">
                                <span className="text-sm font-black text-[#D4AF37]">JOB QUOTE (₦)</span>
                                <input type="number" min="1" step="1" value={quoteDrafts[job.id] ?? ""} onChange={(e) => setQuoteDrafts((current) => ({ ...current, [job.id]: e.target.value }))} placeholder="Enter agreed amount" className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 outline-none" />
                              </label>
                              <button disabled={busy} onClick={() => void sendQuote(job)} className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-black text-black disabled:opacity-50">{job.quoted_amount ? "Update Quote" : "Send Quote"}</button>
                            </div>
                            <p className="mt-3 text-sm text-zinc-400">Current quote: <span className="font-black text-white">{naira(job.quoted_amount)}</span> • Customer status: <span className="font-black text-[#D4AF37]">{label(job.quote_status)}</span></p>
                            {job.quote_status === "pending" && <p className="mt-2 text-xs text-zinc-500">Wait for the customer to accept before starting work.</p>}
                            {job.quote_status === "rejected" && <p className="mt-2 text-xs text-amber-300">The customer rejected this quote. Enter a revised amount and send again.</p>}
                          </div>
                        )}

                        {!['completed', 'cancelled'].includes(job.status) && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {['open', 'matched'].includes(job.status) && <button disabled={busy} onClick={() => void updateJobStatus(job, 'accepted')} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-50">Accept Job</button>}
                            {job.status === 'accepted' && !canStart && <span className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-400">Customer must accept your quote before work starts</span>}
                            {canStart && <button disabled={busy} onClick={() => void updateJobStatus(job, 'in_progress')} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-black text-black disabled:opacity-50">Start Job</button>}
                            {job.status === 'in_progress' && <button disabled={busy} onClick={() => void updateJobStatus(job, 'completed')} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black disabled:opacity-50">Mark Completed</button>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
