"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveUserAccess } from "@/lib/access";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";
import BrandLogo from "../../brand-logo";

type IncidentRow = {
  id: string;
  job_id: string;
  reporter_user_id: string | null;
  reporter_role: "customer" | "provider";
  category: string;
  severity: "standard" | "urgent";
  description: string;
  contact_permission: boolean;
  status: "open" | "in_review" | "resolved" | "dismissed";
  admin_note: string | null;
  resolution_message: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  jobs: {
    service_category: string;
    location: string;
    status: string;
  } | null;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminSafetyPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [savingId, setSavingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleRows = useMemo(
    () => filter === "all" ? rows : rows.filter((row) => row.status === "open" || row.status === "in_review"),
    [rows, filter],
  );

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fadmin%2Fsafety");
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
      if (!access.isAdmin) {
        window.location.assign("/");
        return;
      }
      await load(current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load safety reports.");
    } finally {
      setLoading(false);
    }
  }

  async function load(current: AuthSession) {
    const incidents = await restGet<IncidentRow[]>(
      "safety_incidents?select=id,job_id,reporter_user_id,reporter_role,category,severity,description,contact_permission,status,admin_note,resolution_message,created_at,updated_at,reviewed_at,jobs(service_category,location,status)&order=created_at.desc&limit=200",
      current.access_token,
    );
    setRows(incidents);
    setNotes(Object.fromEntries(incidents.map((row) => [row.id, row.admin_note ?? ""])));
    setMessages(Object.fromEntries(incidents.map((row) => [row.id, row.resolution_message ?? ""])));
  }

  async function updateIncident(row: IncidentRow, status: IncidentRow["status"]) {
    if (!session) return;
    setSavingId(row.id);
    setError("");
    setNotice("");

    try {
      await restPatch<IncidentRow[]>(
        "safety_incidents",
        `id=eq.${row.id}`,
        {
          status,
          admin_note: notes[row.id]?.trim() || null,
          resolution_message: messages[row.id]?.trim() || null,
        },
        session.access_token,
      );
      setNotice(`Safety report ${row.id.slice(0, 8)} updated to ${label(status)}.`);
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the safety report.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-6 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a href="/admin-dashboard"><BrandLogo /></a>
          <a href="/admin-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Admin Dashboard</a>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-red-300">ADMIN SAFETY REVIEW</p>
            <h1 className="mt-2 text-4xl font-black">Safety incidents</h1>
            <p className="mt-2 text-sm text-zinc-400">Review reported concerns without exposing this workflow to ordinary users.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFilter("active")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "active" ? "bg-[#D4AF37] text-black" : "border border-white/10 text-zinc-300"}`}>Active</button>
            <button onClick={() => setFilter("all")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "all" ? "bg-[#D4AF37] text-black" : "border border-white/10 text-zinc-300"}`}>All</button>
          </div>
        </div>

        {notice && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading safety reports…</div>
        ) : visibleRows.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No safety reports in this view.</div>
        ) : (
          <div className="mt-6 grid gap-5">
            {visibleRows.map((row) => {
              const busy = savingId === row.id;
              return (
                <article key={row.id} className={`rounded-3xl border p-6 ${row.severity === "urgent" ? "border-red-500/30 bg-red-950/10" : "border-white/10 bg-[#121212]"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black">{label(row.category)}</h2>
                        {row.severity === "urgent" && <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-black text-red-300">URGENT</span>}
                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-zinc-300">{label(row.status)}</span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {row.reporter_role} • reporter {row.reporter_user_id?.slice(0, 8) ?? "deleted"} • job {row.job_id.slice(0, 8)} • {new Date(row.created_at).toLocaleString()}
                      </p>
                      {row.jobs && <p className="mt-2 text-sm text-zinc-400">{row.jobs.service_category} • {row.jobs.location} • {label(row.jobs.status)}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${row.contact_permission ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-300"}`}>
                      {row.contact_permission ? "CONTACT ALLOWED" : "NO CONTACT REQUESTED"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{row.description}</p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-bold">
                      Internal admin note
                      <textarea
                        rows={4}
                        value={notes[row.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 font-normal outline-none"
                        placeholder="Internal note — not shown to the reporter"
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      Message visible to reporter
                      <textarea
                        rows={4}
                        value={messages[row.id] ?? ""}
                        onChange={(event) => setMessages((current) => ({ ...current, [row.id]: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 font-normal outline-none"
                        placeholder="Optional update shown in the reporter's Safety Center"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => void updateIncident(row, "in_review")} className="rounded-xl border border-blue-500/30 px-4 py-2 text-sm font-bold text-blue-300 disabled:opacity-50">Mark In Review</button>
                    <button disabled={busy} onClick={() => void updateIncident(row, "resolved")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black disabled:opacity-50">Resolve</button>
                    <button disabled={busy} onClick={() => void updateIncident(row, "dismissed")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-300 disabled:opacity-50">Dismiss</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
