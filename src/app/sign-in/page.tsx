"use client";

import { FormEvent, useState } from "react";

export default function SignInPage() {
  const [submitted, setSubmitted] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
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
          <h1 className="text-3xl font-black">Sign in to Rydah Local</h1>
          <p className="mt-3 text-zinc-400">
            This MVP uses a demo sign-in screen until secure backend authentication is connected.
          </p>

          {submitted ? (
            <div className="mt-6 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5">
              <p className="font-bold text-[#D4AF37]">Demo sign-in successful.</p>
              <p className="mt-2 text-sm text-zinc-400">Authentication backend will be connected before production launch.</p>
              <a href="/providers" className="mt-5 inline-block rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Continue</a>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-bold">Account type</label>
              <select className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                <option>Customer</option>
                <option>Service Provider</option>
              </select>

              <label className="mt-5 block text-sm font-bold">Email</label>
              <input
                required
                type="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
              />

              <button type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black">
                Continue
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
