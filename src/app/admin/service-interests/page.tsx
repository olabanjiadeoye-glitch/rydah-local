"use client";

import { useEffect, useState } from "react";
import { getStoredSession, restGet, restPatch, type AuthSession } from "@/lib/supabase";

type InterestRow = {
  id: string;
  user_id: string;
  profession: string;
  location: string;
  experience_years: number;
  note: string | null;
  status: "new" | "reviewing" | "approved" | "declined";
  admin_note: string | null;
  created_at: string;
  providers: { business_name: string } | null;
};

const statuses: InterestRow["status"][] = ["new", "reviewing", "approved", "declined"];

export default function AdminServiceInterestsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<InterestRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in");
      return;
    }
    setSession(current);
    void load(current);
  }, []);

  async function load(current: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const interests = await restGet<InterestRow[]>(
        "provider_service_interests?select=id,user_id,profession,location,experience_years,note,status,admin_note,created_at,providers(business_name)&order=created_at.desc",
        current.access_token,
      );
      setRows(interests);
      setNotes(Object.fromEntries(interests.map((row) => [row.id, row.admin_note || ""])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load profession interests.");
    } finally {
      setLoading(false);
    }
  }

  async function update(row: InterestRow, status: InterestRow["status"]) {
    if (!session) return;
    setSavingId(row.id);
    setError("");
    setMessage("");
    try {
      const updated = await restPatch<InterestRow[]>(
        "provider_service_interests",
        `id=eq.${row.id}`,
        {
          status,
          admin_note: notes[row.id]?.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.user.id,
        },
        session.access_token,
      );
      if (!updated[0]) throw new Error("Updated profession interest was not returned.");
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...updated[0], providers: item.providers } : item));
      setMessage(`${row.profession} marked ${status}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update profession interest.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH ADMIN</p>
            <h1 className="mt-1 text-2xl font-black">New Profession Interests</h1>
          </div>
          <a href="/admin-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Admin Dashboard</a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-7 sm:py-6">
        <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#121212] p-6">
          <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">MARKET EXPANSION</p>
          <h2 className="mt-2 text-3xl font-black">See what professionals want to offer</h2>
          <p className="mt-3 max-w-3xl text-zinc-400">Review demand before adding a new category. Approval here records operational interest; it does not automatically bypass provider identity, payout or safety verification.</p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading profession interests…</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No profession interests yet.</div>
        ) : (
          <div className="mt-6 grid gap-5">
            {rows.map((row) => {
              const busy = savingId === row.id;
              return (
                <article key={row.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black">{row.profession}</h3>
                      <p className="mt-1 text-zinc-400">{row.location} • {row.experience_years} years</p>
                      <p className="mt-2 text-sm text-zinc-500">Provider: {row.providers?.business_name || "Profile not created yet"} • Submitted {new Date(row.created_at).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#D4AF37]">{row.status.toUpperCase()}</span>
                  </div>

                  {row.note && <p className="mt-4 rounded-2xl bg-[#1A1A1A] p-4 text-sm leading-6 text-zinc-300">{row.note}</p>}

                  <label className="mt-5 block">
                    <span className="text-sm font-bold">Admin note</span>
                    <textarea value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} maxLength={1000} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" placeholder="Verification requirements, demand notes, next steps…" />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {statuses.map((status) => (
                      <button key={status} disabled={busy || row.status === status} onClick={() => void update(row, status)} className={`rounded-xl px-4 py-3 text-sm font-black disabled:opacity-35 ${status === "approved" ? "bg-emerald-500/15 text-emerald-300" : status === "declined" ? "bg-red-500/15 text-red-300" : "border border-white/10 text-zinc-300"}`}>
                        {status.replace(/^./, (letter) => letter.toUpperCase())}
                      </button>
                    ))}
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
