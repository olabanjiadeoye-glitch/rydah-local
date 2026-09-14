"use client";

import { FormEvent, useEffect, useState } from "react";
import { saveSession, signInWithPassword, signUpWithPassword, type AuthSession } from "@/lib/supabase";

function accountDestination(session: AuthSession) {
  return session.user.user_metadata?.role === "provider" ? "/provider-dashboard" : "/providers";
}

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [role, setRole] = useState<"customer" | "provider">("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirmed") === "1") {
      setMessage("Email confirmed. You can sign in now.");
      if (window.location.hash) {
        window.history.replaceState({}, "", "/sign-in?confirmed=1");
      }
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "sign-in") {
        const session = await signInWithPassword(email, password);
        saveSession(session);
        window.location.href = accountDestination(session);
        return;
      }

      const result = await signUpWithPassword({
        email,
        password,
        fullName,
        role,
        redirectTo: `${window.location.origin}/sign-in?confirmed=1`,
      });

      if (result.access_token && result.user) {
        const session = result as AuthSession;
        saveSession(session);
        window.location.href = accountDestination(session);
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

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
          <p className="font-black">RYDAH <span className="text-[#D4AF37]">LOCAL</span></p>
          <a href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</a>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-5 py-12">
        <div className="rounded-3xl border border-white/10 bg-[#121212] p-7">
          <h1 className="text-3xl font-black">{mode === "sign-in" ? "Sign in" : "Create account"}</h1>
          <p className="mt-3 text-zinc-400">Secure authentication is connected to the Rydah Local backend.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#1A1A1A] p-1">
            <button type="button" onClick={() => setMode("sign-in")} className={`rounded-xl px-3 py-3 font-bold ${mode === "sign-in" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}>Sign In</button>
            <button type="button" onClick={() => setMode("sign-up")} className={`rounded-xl px-3 py-3 font-bold ${mode === "sign-up" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}>Create Account</button>
          </div>

          <form onSubmit={submit} className="mt-6">
            {mode === "sign-up" && (
              <>
                <label className="block text-sm font-bold">Account type</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "customer" | "provider")} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                  <option value="customer">Customer</option>
                  <option value="provider">Service Provider</option>
                </select>

                <label className="mt-5 block text-sm font-bold">Full name</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
              </>
            )}

            <label className="mt-5 block text-sm font-bold">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            <label className="mt-5 block text-sm font-bold">Password</label>
            <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            {message && <div className="mt-5 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">{message}</div>}
            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button disabled={loading} type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black disabled:opacity-60">
              {loading ? "Please wait..." : mode === "sign-in" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
