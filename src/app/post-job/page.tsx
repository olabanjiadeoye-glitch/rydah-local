"use client";

import { FormEvent, useEffect, useState } from "react";

export default function PostJobPage() {
  const [urgent, setUrgent] = useState(false);
  const [provider, setProvider] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrgent(params.get("urgent") === "1");
    setProvider(params.get("provider") ?? "");
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Post a Job</h1>
          </div>
          <a href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        {submitted ? (
          <div className="rounded-3xl border border-[#D4AF37]/30 bg-[#121212] p-8 text-center">
            <div className="text-5xl">✓</div>
            <h2 className="mt-4 text-3xl font-black">Request received</h2>
            <p className="mt-3 text-zinc-400">
              Your {urgent ? "urgent " : ""}request has been prepared for matching with verified providers.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href="/providers" className="rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black">Browse Providers</a>
              <a href="/" className="rounded-2xl border border-white/10 px-5 py-4 font-bold">Back Home</a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
            {provider && (
              <div className="mb-5 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
                Provider selected: {provider.replaceAll("-", " ")}
              </div>
            )}

            <label className="block text-sm font-bold">What service do you need?</label>
            <select required className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
              <option value="">Choose a service</option>
              <option>Electrician</option>
              <option>Plumber</option>
              <option>AC Technician</option>
              <option>Generator</option>
              <option>Cleaning</option>
              <option>Mechanic</option>
            </select>

            <label className="mt-5 block text-sm font-bold">Location</label>
            <select required className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
              <option>Lekki, Lagos</option>
              <option>Victoria Island, Lagos</option>
              <option>Ikeja, Lagos</option>
            </select>

            <label className="mt-5 block text-sm font-bold">Describe the job</label>
            <textarea
              required
              minLength={10}
              rows={5}
              placeholder="Tell providers what you need..."
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600"
            />

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
              <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
              <span>
                <span className="block font-bold">Urgent request</span>
                <span className="text-sm text-zinc-500">I need someone as soon as possible.</span>
              </span>
            </label>

            <button type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black">
              Submit Job Request
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
