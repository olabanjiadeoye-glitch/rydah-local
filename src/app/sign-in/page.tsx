"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  requestPasswordReset,
  saveSession,
  signInWithPassword,
  signUpWithPassword,
  type AuthSession,
} from "@/lib/supabase";
import { canAccessPath, destinationForAccess, resolveUserAccess } from "@/lib/access";
import BrandLogo from "../brand-logo";

const PRODUCTION_ORIGIN = "https://rydahlocal.online";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function strongPasswordError(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  return "";
}

async function sendToCorrectArea(session: AuthSession, nextPath: string | null) {
  const access = await resolveUserAccess(session);
  if (nextPath && access.role === "customer") {
    const pathname = nextPath.split("?", 1)[0] || "/";
    if (canAccessPath(access.role, pathname)) {
      window.location.href = nextPath;
      return;
    }
  }
  window.location.href = destinationForAccess(access);
}

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [role, setRole] = useState<"customer" | "provider">("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(params.get("next")));

    if (params.get("mode") === "sign-up") setMode("sign-up");
    if (params.get("role") === "provider") setRole("provider");
    if (params.get("role") === "customer") setRole("customer");

    if (params.get("confirmed") === "1") {
      setMessage("Email confirmed. You can sign in now.");
      if (window.location.hash) {
        const next = safeNextPath(params.get("next"));
        const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";
        window.history.replaceState({}, "", `/sign-in?confirmed=1${nextQuery}`);
      }
    }
    if (params.get("reset") === "1") {
      setMessage("Password updated. Sign in with your new password.");
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "forgot") {
        await requestPasswordReset(email.trim().toLowerCase(), `${PRODUCTION_ORIGIN}/reset-password`);
        setMessage("Password reset email sent. Open the newest email and tap the reset link.");
        return;
      }

      if (mode === "sign-in") {
        const session = await signInWithPassword(email.trim().toLowerCase(), password);
        saveSession(session);
        await sendToCorrectArea(session, nextPath);
        return;
      }

      const passwordError = strongPasswordError(password);
      if (passwordError) throw new Error(passwordError);

      const nextQuery = role === "customer" && nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
      const result = await signUpWithPassword({
        email: email.trim().toLowerCase(),
        password,
        fullName,
        role,
        redirectTo: `${PRODUCTION_ORIGIN}/sign-in?confirmed=1${nextQuery}`,
      });

      if (result.access_token && result.user) {
        const session = result as AuthSession;
        saveSession(session);
        await sendToCorrectArea(session, role === "customer" ? nextPath : null);
        return;
      }

      setMessage("Account created. Check your email to confirm your account, then sign in.");
      setMode("sign-in");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "sign-up" ? "Create account" : mode === "forgot" ? "Reset password" : "Sign in";

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
          <Link href="/" aria-label="Rydah Local home"><BrandLogo compact /></Link>
          <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</Link>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-6">
        <div className="rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6">
          <h1 className="text-3xl font-black">{title}</h1>
          <p className="mt-3 text-zinc-400">
            {mode === "forgot"
              ? "Enter your account email and Rydah will send you a secure password reset link."
              : nextPath && role === "customer"
                ? "Sign in or create a customer account to continue your Rydah request."
                : "Secure authentication is connected to the Rydah Local backend."}
          </p>

          {mode !== "forgot" && (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#1A1A1A] p-1">
              <button type="button" onClick={() => { setMode("sign-in"); setShowPassword(false); }} className={`rounded-xl px-3 py-3 font-bold ${mode === "sign-in" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}>Sign In</button>
              <button type="button" onClick={() => { setMode("sign-up"); setShowPassword(false); }} className={`rounded-xl px-3 py-3 font-bold ${mode === "sign-up" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}>Create Account</button>
            </div>
          )}

          <form onSubmit={submit} className="mt-6">
            {mode === "sign-up" && (
              <>
                <label className="block text-sm font-bold">Account type</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "customer" | "provider")} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                  <option value="customer">Customer</option>
                  <option value="provider">Service Provider</option>
                </select>

                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                  {role === "provider"
                    ? "Provider setup is guided step by step. Founding 100 places can include free registration plus 3 months free; otherwise the standard ₦500 registration and ₦500/month provider membership apply. Add your service, complete billing when due, verify your identity, then go online."
                    : "Customer accounts can browse verified providers, post jobs and track payments."}
                </div>

                <label className="mt-5 block text-sm font-bold">Full name</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </>
            )}

            <label className="mt-5 block text-sm font-bold">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            {mode !== "forgot" && (
              <>
                <label className="mt-5 block text-sm font-bold" htmlFor="rydah-password">Password</label>
                <div className="relative mt-2">
                  <input
                    id="rydah-password"
                    required
                    minLength={mode === "sign-up" ? 8 : 1}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "sign-up" ? "8+ chars, upper/lowercase & number" : "Your password"}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    spellCheck={false}
                    autoCapitalize="none"
                    className="w-full rounded-2xl border border-white/10 bg-[#1A1A1A] py-4 pl-4 pr-14 outline-none placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex w-14 items-center justify-center rounded-r-2xl text-zinc-400 transition hover:text-[#D4AF37] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37]"
                  >
                    {showPassword ? (
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
                {mode === "sign-up" && <p className="mt-2 text-xs text-zinc-500">Use at least 8 characters with uppercase, lowercase and a number.</p>}
              </>
            )}

            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button
              disabled={
                loading ||
                !email.trim() ||
                (mode !== "forgot" && !password) ||
                (mode === "sign-up" && !fullName.trim())
              }
              type="submit"
              className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Please wait..." : mode === "forgot" ? "Send Reset Email" : mode === "sign-in" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {mode === "sign-in" && (
            <button type="button" onClick={() => { setMode("forgot"); setShowPassword(false); setError(""); setMessage(""); }} className="mt-5 w-full text-center text-sm font-semibold text-[#D4AF37]">Forgot password?</button>
          )}

          {mode === "forgot" && (
            <button type="button" onClick={() => { setMode("sign-in"); setShowPassword(false); setError(""); setMessage(""); }} className="mt-5 w-full text-center text-sm font-semibold text-[#D4AF37]">Back to sign in</button>
          )}
        </div>
      </section>
    </main>
  );
}
