"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveUserAccess } from "@/lib/access";
import {
  getStoredSession,
  invokeFunction,
  restGet,
  restPatch,
  type AuthSession,
} from "@/lib/supabase";
import BrandLogo from "../../brand-logo";

type DisputeRow = {
  id: string;
  job_id: string;
  payment_id: string | null;
  reporter_user_id: string | null;
  reporter_role: string;
  category: string;
  description: string;
  requested_refund_amount_naira: number | null;
  status: "open" | "in_review" | "resolved" | "rejected" | "refund_pending" | "refunded";
  admin_note: string | null;
  resolution_message: string | null;
  created_at: string;
  jobs: { service_category: string; location: string; status: string } | null;
  payments: {
    amount_naira: number;
    status: string;
    reference: string;
    is_test: boolean;
    refund_status: string;
    gateway: string;
  } | null;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function naira(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG")}`;
}

export default function AdminDisputesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const visibleRows = useMemo(
    () => filter === "all"
      ? rows
      : rows.filter((row) => ["open", "in_review", "refund_pending"].includes(row.status)),
    [rows, filter],
  );

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign("/sign-in?next=%2Fadmin%2Fdisputes");
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
      setError(caught instanceof Error ? caught.message : "Unable to load disputes.");
    } finally {
      setLoading(false);
    }
  }

  async function load(current: AuthSession) {
    const disputes = await restGet<DisputeRow[]>(
      "payment_disputes?select=id,job_id,payment_id,reporter_user_id,reporter_role,category,description,requested_refund_amount_naira,status,admin_note,resolution_message,created_at,jobs(service_category,location,status),payments(amount_naira,status,reference,is_test,refund_status,gateway)&order=created_at.desc&limit=200",
      current.access_token,
    );
    setRows(disputes);
    setNotes(Object.fromEntries(disputes.map((row) => [row.id, row.admin_note ?? ""])));
    setMessages(Object.fromEntries(disputes.map((row) => [row.id, row.resolution_message ?? ""])));
  }

  async function updateDispute(row: DisputeRow, status: DisputeRow["status"]) {
    if (!session) return;
    setBusyId(row.id);
    setError("");
    setNotice("");

    try {
      await restPatch(
        "payment_disputes",
        `id=eq.${row.id}`,
        {
          status,
          admin_note: notes[row.id]?.trim() || null,
          resolution_message: messages[row.id]?.trim() || null,
        },
        session.access_token,
      );
      setNotice(`Dispute ${row.id.slice(0, 8)} updated to ${label(status)}.`);
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update dispute.");
    } finally {
      setBusyId("");
    }
  }

  async function approveRefund(row: DisputeRow) {
    if (!session) return;

    const confirmed = window.confirm(
      row.payments?.is_test
        ? "Approve this full TEST refund through Paystack?"
        : "Approve this full LIVE refund through Paystack? Live refunds must also be enabled in Rydah settings.",
    );
    if (!confirmed) return;

    setBusyId(row.id);
    setError("");
    setNotice("");

    try {
      const response = await invokeFunction(
        "admin-refund-payment",
        { dispute_id: row.id },
        session.access_token,
      );
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to initiate refund.");

      setNotice(result.message || "Refund initiated.");
      await load(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to initiate refund.");
    } finally {
      setBusyId("");
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
            <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">ADMIN RESOLUTION CENTRE</p>
            <h1 className="mt-2 text-4xl font-black">Disputes & refunds</h1>
            <p className="mt-2 text-sm text-zinc-400">Review disputes before any payment action. Users cannot trigger refunds directly.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFilter("active")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "active" ? "bg-[#D4AF37] text-black" : "border border-white/10 text-zinc-300"}`}>Active</button>
            <button onClick={() => setFilter("all")} className={`rounded-xl px-4 py-2 text-sm font-bold ${filter === "all" ? "bg-[#D4AF37] text-black" : "border border-white/10 text-zinc-300"}`}>All</button>
          </div>
        </div>

        {notice && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{notice}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">Loading disputes…</div>
        ) : visibleRows.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 text-zinc-400">No disputes in this view.</div>
        ) : (
          <div className="mt-6 grid gap-5">
            {visibleRows.map((row) => {
              const busy = busyId === row.id;
              const canRefund = Boolean(
                row.requested_refund_amount_naira
                && row.payment_id
                && row.payments?.gateway === "paystack"
                && row.payments?.status === "paid"
                && row.payments?.refund_status === "none"
                && ["open", "in_review"].includes(row.status),
              );

              return (
                <article key={row.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black">{label(row.category)}</h2>
                      <p className="mt-1 text-xs text-zinc-500">
                        {row.reporter_role} • reporter {row.reporter_user_id?.slice(0, 8) ?? "deleted"} • job {row.job_id.slice(0, 8)} • {new Date(row.created_at).toLocaleString()}
                      </p>
                      {row.jobs && <p className="mt-2 text-sm text-zinc-400">{row.jobs.service_category} • {row.jobs.location} • {label(row.jobs.status)}</p>}
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-zinc-300">{label(row.status)}</span>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{row.description}</p>
                  </div>

                  {row.payments && (
                    <div className="mt-4 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 text-sm">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-black text-[#E5C65A]">{naira(row.payments.amount_naira)} • {row.payments.is_test ? "TEST" : "LIVE"} Paystack</p>
                          <p className="mt-1 text-zinc-400">{row.payments.reference}</p>
                        </div>
                        <p className="font-bold text-zinc-300">Refund: {label(row.payments.refund_status)}</p>
                      </div>
                      {row.requested_refund_amount_naira && (
                        <p className="mt-3 font-bold text-white">Requested full refund: {naira(row.requested_refund_amount_naira)}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-bold">
                      Internal admin note
                      <textarea
                        rows={4}
                        value={notes[row.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 font-normal outline-none"
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      Message visible to reporter
                      <textarea
                        rows={4}
                        value={messages[row.id] ?? ""}
                        onChange={(event) => setMessages((current) => ({ ...current, [row.id]: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-3 font-normal outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => void updateDispute(row, "in_review")} className="rounded-xl border border-blue-500/30 px-4 py-2 text-sm font-bold text-blue-300 disabled:opacity-40">Mark In Review</button>
                    <button disabled={busy} onClick={() => void updateDispute(row, "resolved")} className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm font-bold text-emerald-300 disabled:opacity-40">Resolve Without Refund</button>
                    <button disabled={busy} onClick={() => void updateDispute(row, "rejected")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-300 disabled:opacity-40">Reject</button>
                    {canRefund && (
                      <button disabled={busy} onClick={() => void approveRefund(row)} className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-black text-black disabled:opacity-40">
                        {busy ? "Working…" : row.payments?.is_test ? "Approve Test Refund" : "Approve Live Refund"}
                      </button>
                    )}
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
