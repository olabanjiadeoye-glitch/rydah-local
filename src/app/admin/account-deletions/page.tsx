"use client";

import { useEffect, useState } from "react";
import { resolveUserAccess } from "@/lib/access";
import { getStoredSession, invokeFunction, restGet, type AuthSession } from "@/lib/supabase";
import BrandLogo from "../../brand-logo";

type DeletionRequest = {
  id: string;
  user_id: string | null;
  reason: string | null;
  status: "pending" | "completed" | "declined";
  requested_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
};

export default function AdminAccountDeletionsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fadmin%2Faccount-deletions");
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
      setError(caught instanceof Error ? caught.message : "Unable to load deletion requests.");
    } finally {
      setLoading(false);
    }
  }

  async function load(current: AuthSession) {
    const result = await restGet<DeletionRequest[]>(
      "account_deletion_requests?select=id,user_id,reason,status,requested_at,completed_at,reviewed_at&order=requested_at.desc&limit=200",
      current.access_token,
    );
    setRows(result);
  }

  async function processRequest(row: DeletionRequest) {
    if (!session || !row.user_id || row.status !== "pending") return;

    const confirmed = window.confirm(
      "This will anonymise retained Rydah records and permanently delete this Supabase Auth account. Continue?",
    );
    if (!confirmed) return;

    setBusyId(row.id);
    setError("");
    setMessage("");

    try {
      const response = await invokeFunction(
        "account-deletion-admin",
        { request_id: row.id },
        session.access_token,
      );
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to complete account deletion.");

      setMessage(result.message || "Account deletion completed.");
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete account deletion.");
    } finally {
      setBusyId("");
    }
  }

  const pending = rows.filter((row) => row.status === "pending");
  const completed = rows.filter((row) => row.status === "completed");

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-8 text-white">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a href="/admin-dashboard"><BrandLogo /></a>
          <a href="/admin-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">
            Admin Dashboard
          </a>
        </div>

        <div className="mt-8 rounded-3xl border border-red-500/20 bg-red-950/10 p-6">
          <p className="text-xs font-black tracking-[0.18em] text-red-300">ACCOUNT DELETION ADMIN</p>
          <h1 className="mt-2 text-3xl font-black">Deletion requests</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
            Completing a request anonymises retained job/provider records, preserves the minimum financial audit trail without the user link, removes account-access data, and permanently deletes the Supabase Auth account.
          </p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-7 text-zinc-400">Loading deletion requests…</div>
        ) : (
          <>
            <section className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Pending</h2>
                  <p className="mt-1 text-sm text-zinc-500">{pending.length} request{pending.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              {pending.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">No pending deletion requests.</p>
              ) : (
                <div className="mt-5 grid gap-4">
                  {pending.map((row) => (
                    <article key={row.id} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-black">Request {row.id.slice(0, 8)}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            User {row.user_id?.slice(0, 8) ?? "Unavailable"} • {new Date(row.requested_at).toLocaleString()}
                          </p>
                          {row.reason && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-zinc-300">{row.reason}</p>}
                        </div>
                        <button
                          type="button"
                          disabled={busyId === row.id || !row.user_id}
                          onClick={() => void processRequest(row)}
                          className="rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
                        >
                          {busyId === row.id ? "Deleting…" : "Complete Deletion"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-6">
              <h2 className="text-2xl font-black">Completed</h2>
              {completed.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">No completed deletion requests yet.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {completed.slice(0, 50).map((row) => (
                    <div key={row.id} className="rounded-2xl border border-white/10 bg-[#0D0D0D] p-4">
                      <p className="font-black text-emerald-300">✓ Completed</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Request {row.id.slice(0, 8)} • {row.completed_at ? new Date(row.completed_at).toLocaleString() : "Completed"}
                      </p>
                      <p className="mt-2 text-xs text-zinc-600">User identifier and request reason are scrubbed after successful deletion.</p>
                    </div>
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
