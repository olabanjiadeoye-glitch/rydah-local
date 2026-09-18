"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getStoredSession, restGet, restInsertMinimal, type AuthSession } from "@/lib/supabase";
import BrandLogo from "../brand-logo";

type DeletionRequest = {
  id: string;
  status: "pending" | "completed" | "declined";
  requested_at: string;
};

export default function DeleteAccountPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [existing, setExisting] = useState<DeletionRequest | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const current = getStoredSession();
    setSession(current);

    if (!current) {
      setLoading(false);
      return;
    }

    restGet<DeletionRequest[]>(
      "account_deletion_requests?status=eq.pending&select=id,status,requested_at&order=requested_at.desc&limit=1",
      current.access_token,
    )
      .then((rows) => setExisting(rows[0] ?? null))
      .catch(() => setExisting(null))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    if (!confirmed) {
      setError("Confirm that you want to request account deletion.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await restInsertMinimal(
        "account_deletion_requests",
        {
          user_id: session.user.id,
          reason: reason.trim() || null,
          status: "pending",
        },
        session.access_token,
      );
      setExisting({
        id: "pending",
        status: "pending",
        requested_at: new Date().toISOString(),
      });
      setMessage("Your account deletion request has been submitted.");
      setReason("");
      setConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the deletion request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] px-5 py-7 sm:py-6 text-white">
      <section className="mx-auto max-w-2xl">
        <Link href="/" aria-label="Rydah Local home"><BrandLogo /></Link>

        <h1 className="mt-6 text-4xl font-black">Delete your Rydah account</h1>
        <p className="mt-4 leading-7 text-zinc-400">
          You can request deletion of your Rydah Local account and associated personal data.
          Some records may be retained only where required for completed transactions, fraud prevention,
          disputes, safety, tax, or other legal obligations described in our Privacy Notice.
        </p>

        <div className="mt-7 rounded-3xl border border-red-500/20 bg-red-950/20 p-6">
          <h2 className="text-xl font-black text-red-200">Before you request deletion</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Account deletion is intended to be permanent. Active jobs, unresolved payments, disputes,
            settlements or safety investigations may need to be resolved before the request can be completed.
          </p>
        </div>

        {loading ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6 text-zinc-400">
            Checking your account…
          </div>
        ) : !session ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6">
            <h2 className="text-xl font-black">Sign in to verify the account</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              For security, sign in to the Rydah account you want deleted before submitting the request.
            </p>
            <Link
              href="/sign-in?next=%2Fdelete-account"
              className="mt-5 inline-flex rounded-2xl bg-[#D4AF37] px-5 py-3 font-black text-black"
            >
              Sign in to request deletion
            </Link>
          </div>
        ) : existing ? (
          <div className="mt-7 rounded-3xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-6">
            <h2 className="text-xl font-black text-[#E7C85A]">Deletion request pending</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              A deletion request is already pending for this account. Rydah support will review any active jobs,
              payment obligations and legally required retention before completing the request.
            </p>
            <p className="mt-4 text-sm text-zinc-400">
              Need help? Email <a className="font-bold text-[#D4AF37]" href="mailto:admin@rydahlocal.online">admin@rydahlocal.online</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-7 rounded-3xl border border-white/10 bg-[#121212] p-6">
            <p className="text-sm text-zinc-400">Signed in as</p>
            <p className="mt-1 break-all font-bold">{session.user.email || "Current Rydah account"}</p>

            <label className="mt-6 block text-sm font-bold" htmlFor="deletion-reason">
              Reason <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="deletion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Tell us anything relevant to your request."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
            />

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-300">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#D4AF37]"
              />
              <span>I understand that I am requesting permanent deletion of my Rydah account and associated personal data, subject to limited lawful retention.</span>
            </label>

            {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button
              type="submit"
              disabled={submitting || !confirmed}
              className="mt-6 w-full rounded-2xl bg-red-500 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting request…" : "Request account deletion"}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Privacy Notice</Link>
          <Link href="/support" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Support</Link>
          <Link href="/" className="rounded-xl bg-[#D4AF37] px-4 py-2 font-bold text-black">Home</Link>
        </div>
      </section>
    </main>
  );
}
