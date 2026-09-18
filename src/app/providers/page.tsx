"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentDeviceLocation, type DeviceCoordinates } from "@/lib/device-location";
import { distanceKm, nearestServiceArea, RYDAH_SERVICE_AREA_CENTERS } from "@/lib/locations";
import { getStoredSession, restDelete, restGet, restInsert, type AuthSession } from "@/lib/supabase";

type Provider = {
  id: string;
  name: string;
  slug: string;
  category: string;
  area: string;
  rating: number;
  jobs: number;
  price: number;
  bio: string;
};

type DbProvider = {
  id: string;
  slug: string | null;
  business_name: string;
  service_category: string;
  location: string;
  description: string | null;
  rating: number | string;
  jobs_completed: number;
  starting_price: number | null;
};

const launchCategories = ["Electrician", "Plumber", "AC Technician", "Generator", "Cleaning", "Mechanic"];
const LOCAL_FAVOURITES = "rydah-local-favourites";
const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [location, setLocation] = useState("All Areas");
  const [sort, setSort] = useState("Recommended");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState("Loading biometric-verified providers...");
  const [loadError, setLoadError] = useState("");
  const [userCoordinates, setUserCoordinates] = useState<DeviceCoordinates | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("category");
    if (requested) setCategory(requested);

    const storedSession = getStoredSession();
    setSession(storedSession);

    const load = async () => {
      try {
        const rows = await restGet<DbProvider[]>(
          "providers?select=id,slug,business_name,service_category,location,description,rating,jobs_completed,starting_price&is_verified=eq.true&biometric_verified=eq.true&is_available=eq.true&order=rating.desc,business_name.asc",
          storedSession?.access_token,
        );

        setProviders(rows.map((row) => ({
          id: row.id,
          name: row.business_name,
          slug: row.slug || row.id,
          category: row.service_category,
          area: row.location,
          rating: Number(row.rating),
          jobs: row.jobs_completed,
          price: row.starting_price ?? 0,
          bio: row.description || "Verified local professional on Rydah Local.",
        })));
        setStatus("Live biometric-verified provider data");
        setLoadError("");

        if (storedSession) {
          const favouriteRows = await restGet<{ provider_id: string }[]>(
            `favorites?select=provider_id&user_id=eq.${storedSession.user.id}`,
            storedSession.access_token,
          );
          setFavorites(favouriteRows.map((item) => item.provider_id));
        } else {
          try {
            setFavorites(JSON.parse(window.localStorage.getItem(LOCAL_FAVOURITES) || "[]") as string[]);
          } catch {
            setFavorites([]);
          }
        }
      } catch (caught) {
        setProviders([]);
        setStatus("Provider service unavailable");
        setLoadError(caught instanceof Error ? caught.message : "Unable to load verified providers right now.");
      }
    };

    void load();
  }, []);

  const categories = useMemo(() => {
    const discovered = providers.map((provider) => provider.category).filter(Boolean);
    return ["All", ...Array.from(new Set([...launchCategories, ...discovered])).sort((a, b) => a.localeCompare(b))];
  }, [providers]);

  const locations = useMemo(() => {
    const discovered = providers.map((provider) => provider.area).filter(Boolean);
    return ["All Areas", ...Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b))];
  }, [providers]);

  const visibleProviders = useMemo(() => {
    let result = providers.filter((provider) => {
      const search = activeSearch.trim().toLowerCase();
      const matchesSearch = !search || provider.name.toLowerCase().includes(search) || provider.category.toLowerCase().includes(search) || provider.area.toLowerCase().includes(search) || provider.bio.toLowerCase().includes(search);
      const matchesLocation = location === "All Areas" || provider.area === location;
      const matchesCategory = category === "All" || provider.category === category;
      return matchesSearch && matchesLocation && matchesCategory;
    });

    if (sort === "Highest Rated") result = [...result].sort((a, b) => b.rating - a.rating);
    if (sort === "Lowest Starting Price") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "Nearest to Me" && userCoordinates) {
      result = [...result].sort((a, b) => {
        const centerA = RYDAH_SERVICE_AREA_CENTERS[a.area];
        const centerB = RYDAH_SERVICE_AREA_CENTERS[b.area];
        const distanceA = centerA
          ? distanceKm(userCoordinates.latitude, userCoordinates.longitude, centerA.latitude, centerA.longitude)
          : Number.POSITIVE_INFINITY;
        const distanceB = centerB
          ? distanceKm(userCoordinates.latitude, userCoordinates.longitude, centerB.latitude, centerB.longitude)
          : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });
    }
    return result;
  }, [providers, activeSearch, location, sort, category, userCoordinates]);

  async function useCurrentLocation() {
    setGpsBusy(true);
    setLoadError("");
    setGpsMessage("");

    try {
      const coordinates = await getCurrentDeviceLocation();
      const nearest = nearestServiceArea(coordinates.latitude, coordinates.longitude);

      if (!nearest || nearest.distanceKm > 60) {
        setUserCoordinates(null);
        setLocation("All Areas");
        setSort("Recommended");
        setGpsMessage("GPS detected outside Rydah's current Lagos, Abuja and Ibadan coverage. Use the area filter to browse providers in a target city.");
        return;
      }

      setUserCoordinates(coordinates);
      setLocation("All Areas");
      setSort("Nearest to Me");
      setGpsMessage(
        `GPS ready • nearest Rydah target area: ${nearest.area} • accuracy about ${Math.round(coordinates.accuracy)} m. Providers are sorted using their service-area centres, not their private live location.`,
      );
    } catch (caught) {
      setUserCoordinates(null);
      setLoadError(caught instanceof Error ? caught.message : "Unable to use your current location.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function toggleFavorite(provider: Provider) {
    const alreadySaved = favorites.includes(provider.id);
    const next = alreadySaved ? favorites.filter((id) => id !== provider.id) : [...favorites, provider.id];
    setFavorites(next);

    if (!session) {
      window.localStorage.setItem(LOCAL_FAVOURITES, JSON.stringify(next));
      return;
    }

    try {
      if (alreadySaved) {
        await restDelete("favorites", `user_id=eq.${session.user.id}&provider_id=eq.${provider.id}`, session.access_token);
      } else {
        await restInsert("favorites", { user_id: session.user.id, provider_id: provider.id }, session.access_token);
      }
    } catch {
      setFavorites(favorites);
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Find a Provider</h1>
          </div>
          <div className="flex gap-2">
            {session && <a href="/my-jobs" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">My Jobs</a>}
            <a href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">Home</a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#121212] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold tracking-widest text-zinc-500">SEARCH VERIFIED PROFESSIONALS</p>
            <p className="text-xs text-zinc-600">{status}</p>
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setActiveSearch(query)} placeholder="Search electrician, carpenter, cleaner, area or provider..." className="mt-3 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none placeholder:text-zinc-600" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
              {locations.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 outline-none">
              <option>Recommended</option><option>Nearest to Me</option><option>Highest Rated</option><option>Lowest Starting Price</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={() => void useCurrentLocation()}
              className="rounded-xl border border-[#D4AF37]/35 px-4 py-2.5 text-sm font-black text-[#E5C65A] disabled:opacity-40"
            >
              {gpsBusy ? "Finding GPS…" : "📍 Find Providers Near Me"}
            </button>
            {userCoordinates && (
              <button
                type="button"
                onClick={() => {
                  setUserCoordinates(null);
                  setSort("Recommended");
                  setGpsMessage("");
                }}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-400"
              >
                Clear GPS
              </button>
            )}
          </div>
          {gpsMessage && <p className="mt-2 text-xs leading-5 text-emerald-300">{gpsMessage}</p>}
          <button onClick={() => setActiveSearch(query)} className="mt-4 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black">Search Providers</button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${category === item ? "bg-[#D4AF37] text-black" : "border border-white/10 bg-[#121212] text-zinc-300"}`}>{item}</button>)}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex items-end justify-between">
          <div><p className="text-xs font-bold tracking-widest text-[#D4AF37]">VERIFIED & AVAILABLE</p><h2 className="mt-1 text-2xl font-bold">Ready to take a job</h2></div>
          <span className="text-sm text-zinc-500">{visibleProviders.length} providers</span>
        </div>

        {loadError && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-950/20 p-4 text-sm text-red-300">{loadError}</div>}

        {visibleProviders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-8 text-center">
            <p className="text-xl font-bold">No available verified providers found</p>
            <p className="mt-2 text-zinc-500">Try another service or area. Rydah only shows providers who are verified and currently available.</p>
            <a href="/post-job" className="mt-5 inline-block rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-black">Post a Job</a>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleProviders.map((provider) => (
              <article key={provider.id} className="rounded-3xl border border-white/10 bg-[#121212] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-2xl">🛠️</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{provider.name}</h3><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">✓ VERIFIED</span></div>
                      <p className="mt-1 text-sm text-zinc-400">{provider.category} • {provider.area}</p>
                      {userCoordinates && RYDAH_SERVICE_AREA_CENTERS[provider.area] && (
                        <p className="mt-1 text-xs text-emerald-300">
                          ~{distanceKm(
                            userCoordinates.latitude,
                            userCoordinates.longitude,
                            RYDAH_SERVICE_AREA_CENTERS[provider.area].latitude,
                            RYDAH_SERVICE_AREA_CENTERS[provider.area].longitude,
                          ).toFixed(1)} km from you (service-area estimate)
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => void toggleFavorite(provider)} aria-label="Toggle favourite" className="text-2xl">{favorites.includes(provider.id) ? "♥" : "♡"}</button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Rating</p><p className="mt-1 font-bold">⭐ {provider.rating.toFixed(1)}</p></div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Jobs</p><p className="mt-1 font-bold">{provider.jobs}</p></div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">From</p><p className="mt-1 text-sm font-bold">{money(provider.price)}</p></div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-green-400">● Available now</p>
                  <button onClick={() => setSelectedProvider(provider)} className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black">View Profile</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-black tracking-widest text-[#D4AF37]">PROVIDERS</p>
            <h3 className="mt-2 text-xl font-black">Your profession isn&apos;t listed?</h3>
            <p className="mt-2 text-sm text-zinc-400">Service providers can register a genuine profession for Rydah marketplace review instead of choosing the wrong category.</p>
          </div>
          <a href="/provider-interest" className="mt-4 inline-block shrink-0 rounded-xl bg-white px-5 py-3 font-black text-black sm:mt-0">Add Your Profession</a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-6">
          <p className="text-xs font-bold tracking-widest text-red-400">NEED URGENT HELP?</p>
          <h3 className="mt-2 text-xl font-bold">Post your job and Rydah will auto-match an available biometric-verified provider.</h3>
          <a href="/post-job?urgent=1" className="mt-5 inline-block rounded-xl bg-white px-5 py-3 font-bold text-black">Post a Job</a>
        </div>
      </section>

      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#121212] p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold tracking-widest text-[#D4AF37]">VERIFIED PROVIDER</p><h2 className="mt-2 text-2xl font-black">{selectedProvider.name}</h2><p className="mt-1 text-zinc-400">{selectedProvider.category} • {selectedProvider.area}</p></div>
              <button onClick={() => setSelectedProvider(null)} className="rounded-full border border-white/10 px-3 py-2">✕</button>
            </div>
            <p className="mt-5 leading-7 text-zinc-300">{selectedProvider.bio}</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Rating</p><p className="mt-1 font-bold">⭐ {selectedProvider.rating.toFixed(1)}</p></div>
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Jobs</p><p className="mt-1 font-bold">{selectedProvider.jobs}</p></div>
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">From</p><p className="mt-1 font-bold">{money(selectedProvider.price)}</p></div>
            </div>
            <div className="mt-5 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 text-xs leading-5 text-zinc-400">For safety, request and pay through Rydah. Provider profile descriptions cannot include off-platform contact details.</div>
            <a href={`/post-job?provider=${encodeURIComponent(selectedProvider.slug)}`} className="mt-4 block rounded-2xl bg-[#D4AF37] px-5 py-4 text-center font-bold text-black">Request Service</a>
          </div>
        </div>
      )}
    </main>
  );
}
