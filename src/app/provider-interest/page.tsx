"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getStoredSession, restGet, restInsert, type AuthSession } from "@/lib/supabase";
import { containsOffPlatformContact, offPlatformContactMessage } from "@/lib/anti-bypass";
import { getCurrentDeviceLocation } from "@/lib/device-location";
import { displayServiceArea, RYDAH_DEFAULT_SERVICE_AREA, RYDAH_SERVICE_AREAS, RYDAH_TARGET_CITIES, nearestServiceArea, serviceAreasForCity } from "@/lib/locations";

type InterestRow = {
  id: string;
  profession: string;
  location: string;
  experience_years: number;
  note: string | null;
  status: "new" | "reviewing" | "approved" | "declined";
  admin_note: string | null;
  created_at: string;
};

function statusStyle(status: InterestRow["status"]) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-300";
  if (status === "declined") return "bg-red-500/15 text-red-300";
  if (status === "reviewing") return "bg-blue-500/15 text-blue-300";
  return "bg-[#D4AF37]/15 text-[#D4AF37]";
}

export default function ProviderInterestPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState(RYDAH_DEFAULT_SERVICE_AREA);
  const [experienceYears, setExperienceYears] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = getStoredSession();
    if (!current) {
      window.location.assign(`/sign-in?next=${encodeURIComponent("/provider-interest")}`);
      return;
    }
    setSession(current);
    void load(current);
  }, []);

  async function load(current: AuthSession) {
    setLoading(true);
    setError("");
    try {
      const rows = await restGet<InterestRow[]>(
        `provider_service_interests?user_id=eq.${current.user.id}&select=id,profession,location,experience_years,note,status,admin_note,created_at&order=created_at.desc`,
        current.access_token,
      );
      setInterests(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your profession interests.");
    } finally {
      setLoading(false);
    }
  }

  async function detectGpsArea() {
    setGpsBusy(true);
    setError("");
    setGpsMessage("");

    try {
      const coordinates = await getCurrentDeviceLocation();
      const nearest = nearestServiceArea(
        coordinates.latitude,
        coordinates.longitude,
        RYDAH_SERVICE_AREAS,
      );
      if (!nearest || nearest.distanceKm > 60) {
        throw new Error("Your GPS position appears outside Rydah's current Lagos, Abuja, Ibadan, Warri and Port Harcourt coverage. Choose your Nigerian service area manually.");
      }

      setLocation(nearest.area);
      setGpsMessage(`GPS matched you to ${displayServiceArea(nearest.area)} • approx. ${nearest.distanceKm.toFixed(1)} km from the area centre • accuracy ${Math.round(coordinates.accuracy)} m.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to use your current location.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const cleanProfession = profession.trim();
    const cleanNote = note.trim();
    if (cleanProfession.length < 2) {
      setError("Enter the profession or service you want to offer.");
      return;
    }
    if (containsOffPlatformContact(`${cleanProfession} ${cleanNote}`)) {
      setError(offPlatformContactMessage);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const rows = await restInsert<InterestRow[]>(
        "provider_service_interests",
        {
          user_id: session.user.id,
          profession: cleanProfession,
          location,
          experience_years: Number(experienceYears),
          note: cleanNote || null,
        },
        session.access_token,
      );
      if (!rows[0]) throw new Error("Your profession interest was not returned by Rydah.");
      setProfession("");
      setExperienceYears("1");
      setNote("");
      setMessage("Interest received. Rydah can now review this profession for marketplace expansion.");
      await load(session);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Unable to submit your profession interest.";
      setError(detail.includes("duplicate") ? "You already registered this profession for this area." : detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Add Your Profession</h1>
          </div>
          <Link href="/provider-dashboard" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Dashboard</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-6 sm:py-8">
        <div className="rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#17130a] to-[#101010] p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.2em] text-[#D4AF37]">DON&apos;T SEE YOUR TRADE?</p>
          <h2 className="mt-3 text-3xl font-black">Tell Rydah what you do.</h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
            Rydah is expanding beyond the launch categories. Register a genuine profession or service and the operations team can review demand, verification needs and marketplace readiness before it becomes bookable.
          </p>
        </div>

        {message && <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{message}</div>}
        {error && <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>}

        <form onSubmit={submit} className="mt-6 grid gap-5 rounded-3xl border border-white/10 bg-[#121212] p-5 sm:p-6 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-bold">Profession / service</span>
            <input required minLength={2} maxLength={80} value={profession} onChange={(event) => setProfession(event.target.value)} placeholder="e.g. Carpenter, Painter, Appliance Repair" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
          </label>

          <label className="block">
            <span className="text-sm font-bold">Main service area</span>
            <select
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setGpsMessage("");
              }}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none"
            >
              {RYDAH_TARGET_CITIES.map((city) => (
                <optgroup key={city} label={city}>
                  {serviceAreasForCity(city).map((area) => (
                    <option key={area} value={area}>{displayServiceArea(area)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => void detectGpsArea()}
              className="mt-2 rounded-xl border border-[#D4AF37]/35 px-3 py-2 text-xs font-black text-[#E5C65A] disabled:opacity-40"
            >
              {gpsBusy ? "Finding GPS…" : "📍 Detect My Service Area"}
            </button>
            {gpsMessage && <span className="mt-2 block text-xs leading-5 text-emerald-300">{gpsMessage}</span>}
          </label>

          <label className="block">
            <span className="text-sm font-bold">Years of experience</span>
            <input required type="number" min="0" max="60" value={experienceYears} onChange={(event) => setExperienceYears(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none" />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-bold">Tell us about the service</span>
            <textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What jobs do you handle? What tools or qualifications do you have?" className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
            <span className="mt-2 block text-xs text-zinc-500">Do not add phone numbers, email addresses, WhatsApp details or external links.</span>
          </label>

          <button disabled={saving} className="md:col-span-2 rounded-2xl bg-[#D4AF37] px-5 py-4 font-black text-black disabled:opacity-50">
            {saving ? "Submitting…" : "Register Profession Interest"}
          </button>
        </form>

        <div className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">YOUR SUBMISSIONS</p>
              <h2 className="mt-1 text-2xl font-black">Profession review status</h2>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#121212] p-6 text-zinc-400">Loading…</div>
          ) : interests.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-[#121212] p-6 text-zinc-400">No profession interests submitted yet.</div>
          ) : (
            <div className="mt-4 grid gap-4">
              {interests.map((item) => (
                <article key={item.id} className="rounded-3xl border border-white/10 bg-[#121212] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black">{item.profession}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{displayServiceArea(item.location)} • {item.experience_years} years experience</p>
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-black ${statusStyle(item.status)}`}>{item.status.toUpperCase()}</span>
                  </div>
                  {item.note && <p className="mt-4 text-sm leading-6 text-zinc-300">{item.note}</p>}
                  {item.admin_note && <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">Rydah note: {item.admin_note}</div>}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
