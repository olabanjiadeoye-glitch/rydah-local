"use client";

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

type JobSummary = {
  id: string;
  service_category: string;
  location: string;
  status: string;
  created_at: string;
};

type IncidentRow = {
  id: string;
  job_id: string;
  category: string;
  severity: "standard" | "urgent";
  description: string;
  status: "open" | "in_review" | "resolved" | "dismissed";
  resolution_message: string | null;
  created_at: string;
  updated_at: string;
};

const categories = [
  ["identity_concern", "Identity concern"],
  ["unsafe_behaviour", "Unsafe behaviour"],
  ["harassment", "Harassment or intimidation"],
  ["property_issue", "Property damage or concern"],
  ["payment_dispute", "Payment dispute"],
  ["other", "Other safety concern"],
] as const;

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusStyle(status: IncidentRow["status"]) {
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "dismissed") return "bg-zinc-500/15 text-zinc-300";
  if (status === "in_review") return "bg-blue-500/15 text-blue-300";
  return "bg-amber-500/15 text-amber-200";
}

export default function SafetyPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [role, setRole] = useState<Exclude<RydahRole, "admin">>("customer");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [jobId, setJobId] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number][0]>("identity_concern");
  const [severity, setSeverity] = useState<"standard" | "urgent">("standard");
  const [description, setDescription] = useState("");
  const [contactPermission, setContactPermission] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId) ?? null, [jobs, jobId]);

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fsafety");
      return;
    }

    setSession(current);
    void initialise(current);
  }, []);

  async function initialise(current: AuthSession) {
    setLoading(true);
    setError("");

    try {
      const access = await resolveUserAccess(current);
      if (access.role === "admin") {
        window.location.assign("/admin/safety");
        return;
      }

      setRole(access.role);

      const jobRows = access.role === "provider"
        ? await restRpc<JobSummary[]>("provider_job_feed", {}, current.access_token)
        : await restGet<JobSummary[]>(
            `jobs?select=id,service_category,location,status,created_at&customer_id=eq.${current.user.id}&order=created_at.desc&limit=50`,
            current.access_token,
          );

      const incidentRows = await restGet<IncidentRow[]>(
        "safety_incidents?select=id,job_id,category,severity,description,status,resolution_message,created_at,updated_at&order=created_at.desc&limit=50",
        current.access_token,
      );

      const normalizedJobs = Array.isArray(jobRows) ? jobRows : [];
      setJobs(normalizedJobs);
      setIncidents(incidentRows);
      if (!jobId && normalizedJobs[0]?.id) setJobId(normalizedJobs[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the Safety Center.");
    } finally {
      setLoading(false);
    }
  }

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const cleanDescription = description.trim();
    if (!jobId) {
      setError("Choose the related Rydah job.");
      return;
    }
    if (cleanDescription.length < 10) {
      setError("Please give a little more detail so the safety team can review the concern.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await restInsertMinimal(
        "safety_incidents",
        {
          job_id: jobId,
          reporter_user_id: session.user.id,
          reporter_role: role,
          category,
          severity,
          description: cleanDescription,
          contact_permission: contactPermission,
          status: "open",
        },
        session.access_token,
      );

      setDescription("");
      setSeverity("standard");
      setContactPermission(true);
      setMessage("Safety report submitted. Rydah has recorded it for review.");
      await initialise(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the safety report.");
    } finally {
      setSubmitting(false);
    }
  }

  async function shareSelectedJob() {
    if (!selectedJob) return;

    const text = [
      "Rydah Local safety share",
      `Service: ${selectedJob.service_category}`,
      `Area: ${selectedJob.location}`,
      `Status: ${label(selectedJob.status)}`,
      `Job reference: ${selectedJob.id.slice(0, 8)}`,
      "",
      "This safety share intentionally excludes Arrival PINs, payment details and account credentials.",
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "Rydah Local job safety details", text });
        setMessage("Job safety details shared.");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setMessage("Job safety details copied. You can paste them into a message to someone you trust.");
      } else {
        setError("Sharing is not supported by this browser.");
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("Unable to share the job details from this device.");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-8 text-white">
      <section className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" aria-label="Rydah Local home"><BrandLogo /></a>
          <a href={role === "provider" ? "/provider-work" : "/my-jobs"} className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">
            Back to jobs
          </a>
        </div>

        <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-950/20 p-6">
          <p className="text-xs font-black tracking-[0.18em] text-red-300">SAFETY CENTER</p>
          <h1 className="mt-2 text-3xl font-black">Report a concern or share job details</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Rydah Local is not an emergency service. If there is an immediate threat to life, safety or property, move to a safer place where possible and contact the appropriate local emergency service.
          </p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading Safety Center…</div>
        ) : (
          <>
            <form onSubmit={submitIncident} className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <h2 className="text-2xl font-black">Report a safety incident</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Reports are tied to a real Rydah job. Only you and authorised Rydah administrators can read your report through the app.
              </p>

              <label className="mt-5 block text-sm font-bold" htmlFor="safety-job">Related job</label>
              <select
                id="safety-job"
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

              {selectedJob && (
                <button
                  type="button"
                  onClick={() => void shareSelectedJob()}
                  className="mt-3 rounded-xl border border-[#D4AF37]/40 px-4 py-2 text-sm font-bold text-[#E5C65A]"
                >
                  Share Safe Job Details
                </button>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold">
                  Concern type
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as typeof category)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                  >
                    {categories.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  Priority
                  <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value as "standard" | "urgent")}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
                  >
                    <option value="standard">Standard review</option>
                    <option value="urgent">Urgent Rydah review</option>
                  </select>
                </label>
              </div>

              {severity === "urgent" && (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-950/20 p-4 text-sm leading-6 text-red-200">
                  Urgent tells the Rydah team to prioritise the report. It does not contact emergency services.
                </div>
              )}

              <label className="mt-5 block text-sm font-bold" htmlFor="safety-description">What happened?</label>
              <textarea
                id="safety-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Describe what happened, when it happened, and anything the Rydah team should know."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
              />

              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
                <input
                  type="checkbox"
                  checked={contactPermission}
                  onChange={(event) => setContactPermission(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#D4AF37]"
                />
                <span>Rydah may contact me about this safety report using my account contact details.</span>
              </label>

              <button
                type="submit"
                disabled={submitting || !jobId || description.trim().length < 10}
                className="mt-5 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Submitting…" : "Submit Safety Report"}
              </button>
            </form>

            <section className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <h2 className="text-2xl font-black">Your safety reports</h2>
              {incidents.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-400">You have not submitted any safety reports.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {incidents.map((incident) => (
                    <article key={incident.id} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-black">{label(incident.category)}</p>
                          <p className="mt-1 text-xs text-zinc-500">Job {incident.job_id.slice(0, 8)} • {new Date(incident.created_at).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          {incident.severity === "urgent" && <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyle(incident.status)}`}>{label(incident.status)}</span>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{incident.description}</p>
                      {incident.resolution_message && (
                        <div className="mt-4 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 text-sm leading-6 text-zinc-300">
                          <p className="font-black text-[#D4AF37]">Rydah update</p>
                          <p className="mt-1">{incident.resolution_message}</p>
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
