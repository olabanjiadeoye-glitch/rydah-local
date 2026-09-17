"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredSession, restGet, restInsert, type AuthSession } from "@/lib/supabase";

type ProviderLookup = {
  id: string;
  business_name: string;
  slug: string | null;
  service_category: string;
  location: string;
};
type CreatedJob = { id: string };

type AvailabilityRow = {
  service_category: string;
  location: string;
};

export default function PostJobPage() {
  const [urgent, setUrgent] = useState(false);
  const [provider, setProvider] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ProviderLookup | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [service, setService] = useState("");
  const [location, setLocation] = useState("Lekki, Lagos");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [jobId, setJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProvider = params.get("provider") ?? "";
    setUrgent(params.get("urgent") === "1");
    setProvider(requestedProvider);

    const storedSession = getStoredSession();
    if (!storedSession) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/sign-in?next=${encodeURIComponent(next)}`;
      return;
    }
    if (storedSession.user.user_metadata?.role === "provider") {
      window.location.href = "/provider-dashboard";
      return;
    }

    setSession(storedSession);
    if (storedSession.user.email) setContactEmail(storedSession.user.email);

    const initialise = async () => {
      try {
        if (requestedProvider) {
          const rows = await restGet<ProviderLookup[]>(
            `providers?select=id,business_name,slug,service_category,location&slug=eq.${encodeURIComponent(requestedProvider)}&user_id=not.is.null&is_verified=eq.true&is_available=eq.true&limit=1`,
            storedSession.access_token,
          );
          const match = rows[0] ?? null;
          if (!match) {
            setError("This provider is not currently available. Please return to the marketplace and choose another verified provider.");
          } else {
            setSelectedProvider(match);
            setService(match.service_category);
            setLocation(match.location);
          }
        } else {
          const rows = await restGet<AvailabilityRow[]>(
            "providers?select=service_category,location&user_id=not.is.null&is_verified=eq.true&is_available=eq.true",
            storedSession.access_token,
          );
          setAvailability(rows);
          if (rows.length > 0) {
            const firstLocation = rows.some((row) => row.location === "Lekki, Lagos") ? "Lekki, Lagos" : rows[0].location;
            setLocation(firstLocation);
          }
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load live provider availability.");
      } finally {
        setReady(true);
      }
    };

    void initialise();
  }, []);

  const liveLocations = useMemo(
    () => [...new Set(availability.map((row) => row.location))],
    [availability],
  );

  const liveServices = useMemo(
    () => [...new Set(availability.filter((row) => row.location === location).map((row) => row.service_category))],
    [availability, location],
  );

  const changeLocation = (nextLocation: string) => {
    setLocation(nextLocation);
    const servicesThere = availability.filter((row) => row.location === nextLocation).map((row) => row.service_category);
    if (!servicesThere.includes(service)) setService("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError("");

    try {
      let providerId: string | null = null;

      if (selectedProvider) {
        providerId = selectedProvider.id;
      } else if (provider) {
        const matches = await restGet<ProviderLookup[]>(
          `providers?select=id,business_name,slug,service_category,location&slug=eq.${encodeURIComponent(provider)}&user_id=not.is.null&is_verified=eq.true&is_available=eq.true&limit=1`,
          session.access_token,
        );
        providerId = matches[0]?.id ?? null;
        if (!providerId) throw new Error("This provider is not currently available. Please choose another verified provider.");
      } else {
        const matches = await restGet<ProviderLookup[]>(
          `providers?select=id,business_name,slug,service_category,location&user_id=not.is.null&service_category=eq.${encodeURIComponent(service)}&location=eq.${encodeURIComponent(location)}&is_verified=eq.true&is_available=eq.true&order=rating.desc&limit=1`,
          session.access_token,
        );
        providerId = matches[0]?.id ?? null;
        if (!providerId) throw new Error("No verified provider is currently available for this service and location. Please browse providers and try another option.");
      }

      const rows = await restInsert<CreatedJob[]>(
        "jobs",
        {
          customer_id: session.user.id,
          provider_id: providerId,
          service_category: service,
          location,
          description,
          is_urgent: urgent,
          status: "open",
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
          payment_status: "unpaid",
        },
        session.access_token,
      );

      if (!rows[0]?.id) throw new Error("Your request was not returned by the backend.");
      setJobId(rows[0].id);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <main className="min-h-screen bg-[#080808] p-8 text-zinc-400">Preparing your job request...</main>;
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Post a Job</h1>
          </div>
          <a href="/my-jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">My Jobs</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        {submitted ? (
          <div className="rounded-3xl border border-[#D4AF37]/30 bg-[#121212] p-8 text-center">
            <div className="text-5xl">✓</div>
            <h2 className="mt-4 text-3xl font-black">Request sent</h2>
            <p className="mt-3 text-zinc-400">Your {urgent ? "urgent " : ""}request has been assigned to an available verified provider.</p>
            {jobId && <p className="mt-3 text-xs text-zinc-600">Request ID: {jobId.slice(0, 8)}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a href="/my-jobs" className="rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black">Track My Job</a>
              <a href="/providers" className="rounded-2xl border border-white/10 px-5 py-4 font-bold">Browse Providers</a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
            {selectedProvider && (
              <div className="mb-5 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4 text-sm text-[#D4AF37]">
                Provider selected: <strong>{selectedProvider.business_name}</strong> • {selectedProvider.service_category} • {selectedProvider.location}
              </div>
            )}
            {!provider && (
              <div className="mb-5 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4 text-sm text-zinc-400">
                Only services with a genuine verified provider currently online are shown below. Rydah will match your request automatically.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-bold">Your name</label>
                <input required minLength={2} value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
              </div>
              <div>
                <label className="block text-sm font-bold">Phone</label>
                <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} type="tel" placeholder="Phone number" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
              </div>
            </div>

            <label className="mt-5 block text-sm font-bold">Email</label>
            <input required value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            <label className="mt-5 block text-sm font-bold">What service do you need?</label>
            {selectedProvider ? (
              <div className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-zinc-200">{selectedProvider.service_category}</div>
            ) : (
              <select required value={service} onChange={(event) => setService(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                <option value="">Choose an available service</option>
                {liveServices.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}

            <label className="mt-5 block text-sm font-bold">Location</label>
            {selectedProvider ? (
              <div className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-zinc-200">{selectedProvider.location}</div>
            ) : (
              <select required value={location} onChange={(event) => changeLocation(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
                {liveLocations.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}

            {!selectedProvider && availability.length === 0 && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-200">No real verified providers are currently online. Please check back shortly.</div>
            )}

            <label className="mt-5 block text-sm font-bold">Describe the job</label>
            <textarea required minLength={10} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell the provider what you need..." className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1A1A] p-4">
              <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} />
              <span><span className="block font-bold">Urgent request</span><span className="text-sm text-zinc-500">I need someone as soon as possible.</span></span>
            </label>

            {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

            <button disabled={submitting || (!selectedProvider && availability.length === 0)} type="submit" className="mt-6 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black disabled:opacity-60">{submitting ? "Sending request..." : "Submit Job Request"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
