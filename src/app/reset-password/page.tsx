"use client";

import { FormEvent, useEffect, useState } from "react";
import { updatePasswordWithRecoveryToken } from "@/lib/supabase";

function strongPasswordError(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  return "";
}

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
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

    const passwordError = strongPasswordError(password);
    if (passwordError) {
      setError(passwordError);
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
          <p className="mt-3 text-zinc-400">Use at least 8 characters with uppercase, lowercase and a number.</p>

          <form onSubmit={submit} className="mt-6">
            <label className="block text-sm font-bold" htmlFor="new-password">New password</label>
            <div className="relative mt-2">
              <input
                id="new-password"
                required
                minLength={8}
                type={showPasswords ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ chars, upper/lowercase & number"
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] py-4 pl-4 pr-14 outline-none placeholder:text-zinc-600"
              />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                    aria-pressed={showPasswords}
                    title={showPasswords ? "Hide passwords" : "Show passwords"}
                    className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-2xl text-zinc-400 transition hover:text-[#D4AF37] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37]"
                  >
                    {showPasswords ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5.2 0 9 4.5 9 8a8.5 8.5 0 0 1-2 4.2" />
                        <path d="M6.6 6.6C4.3 8 3 10.2 3 12c0 3.5 3.8 8 9 8a9.5 9.5 0 0 0 4.1-.9" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
            </div>

            <label className="mt-5 block text-sm font-bold" htmlFor="confirm-new-password">Confirm new password</label>
            <div className="relative mt-2">
              <input
                id="confirm-new-password"
                required
                minLength={8}
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                spellCheck={false}
                autoCapitalize="none"
                className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] py-4 pl-4 pr-14 outline-none placeholder:text-zinc-600"
              />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                    aria-pressed={showPasswords}
                    title={showPasswords ? "Hide passwords" : "Show passwords"}
                    className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-2xl text-zinc-400 transition hover:text-[#D4AF37] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37]"
                  >
                    {showPasswords ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5.2 0 9 4.5 9 8a8.5 8.5 0 0 1-2 4.2" />
                        <path d="M6.6 6.6C4.3 8 3 10.2 3 12c0 3.5 3.8 8 9 8a9.5 9.5 0 0 0 4.1-.9" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
            </div>

            {confirmPassword && (
              <p className={`mt-2 text-xs ${password === confirmPassword ? "text-emerald-400" : "text-amber-300"}`}>
                {password === confirmPassword ? "Passwords match." : "Passwords do not match yet."}
              </p>
            )}

            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button disabled={loading || !accessToken || !password || !confirmPassword || password !== confirmPassword} type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
