"use client";

import { FormEvent, useEffect, useState } from "react";
import { updatePasswordWithRecoveryToken } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hash.get("access_token") ?? "";
    const type = hash.get("type");

    if (token && (!type || type === "recovery")) {
      setAccessToken(token);
      window.history.replaceState({}, "", "/reset-password");
    } else {
      setError("This password reset link is invalid or has expired. Request a new one from the sign-in page.");
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!accessToken) {
      setError("This password reset link is invalid or has expired.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await updatePasswordWithRecoveryToken(accessToken, password);
      setMessage("Password updated successfully. Redirecting to sign in...");
      window.setTimeout(() => {
        window.location.href = "/sign-in?reset=1";
      }, 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
          <p className="font-black">RYDAH <span className="text-[#D4AF37]">LOCAL</span></p>
          <a href="/sign-in" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Sign in</a>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-12">
        <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
          <h1 className="text-3xl font-black">Choose a new password</h1>
          <p className="mt-3 text-zinc-400">Set a new password for your Rydah account.</p>

          <form onSubmit={submit} className="mt-6">
            <label className="block text-sm font-bold">New password</label>
            <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            <label className="mt-5 block text-sm font-bold">Confirm new password</label>
            <input required minLength={6} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button disabled={loading || !accessToken} type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black disabled:opacity-60">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
