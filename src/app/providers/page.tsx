"use client";

import { useEffect, useMemo, useState } from "react";

type Provider = {
  name: string;
  slug: string;
  category: string;
  area: string;
  rating: number;
  jobs: number;
  verified: boolean;
  price: number;
  availability: "Available now" | "Available today" | "Available tomorrow";
  bio: string;
};

const categories = ["All", "Electrician", "Plumber", "AC Technician", "Generator", "Cleaning", "Mechanic"];

const providers: Provider[] = [
  { name: "Tunde Electrical Services", slug: "tunde-electrical-services", category: "Electrician", area: "Lekki", rating: 4.9, jobs: 128, verified: true, price: 8000, availability: "Available now", bio: "Residential and commercial electrical repairs, installations and fault finding." },
  { name: "PrimeFlow Plumbing", slug: "primeflow-plumbing", category: "Plumber", area: "Victoria Island", rating: 4.8, jobs: 96, verified: true, price: 7500, availability: "Available today", bio: "Plumbing repairs, leak detection, bathroom fittings and emergency call-outs." },
  { name: "CoolAir Lagos", slug: "coolair-lagos", category: "AC Technician", area: "Lekki", rating: 4.9, jobs: 211, verified: true, price: 10000, availability: "Available now", bio: "AC servicing, installation, gas refill and diagnostics for homes and offices." },
  { name: "PowerFix Generator Care", slug: "powerfix-generator-care", category: "Generator", area: "Ikeja", rating: 4.7, jobs: 73, verified: true, price: 9000, availability: "Available today", bio: "Generator servicing, repairs, maintenance and emergency troubleshooting." },
  { name: "SparkleHome Cleaning", slug: "sparklehome-cleaning", category: "Cleaning", area: "Victoria Island", rating: 4.8, jobs: 154, verified: true, price: 12000, availability: "Available tomorrow", bio: "Home, office and post-construction cleaning with flexible bookings." },
  { name: "AutoCare Mobile Mechanic", slug: "autocare-mobile-mechanic", category: "Mechanic", area: "Ikeja", rating: 4.9, jobs: 189, verified: true, price: 15000, availability: "Available now", bio: "Mobile vehicle diagnostics, repairs and roadside assistance across Lagos." },
];

const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;

export default function ProvidersPage() {
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [location, setLocation] = useState("All Lagos");
  const [sort, setSort] = useState("Recommended");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("category");
    if (requested && categories.includes(requested)) setCategory(requested);
  }, []);

  const visibleProviders = useMemo(() => {
    let result = providers.filter((provider) => {
      const search = activeSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        provider.name.toLowerCase().includes(search) ||
        provider.category.toLowerCase().includes(search) ||
        provider.area.toLowerCase().includes(search);
      const matchesLocation = location === "All Lagos" || `${provider.area}, Lagos` === location;
      const matchesCategory = category === "All" || provider.category === category;
      return matchesSearch && matchesLocation && matchesCategory;
    });

    if (sort === "Highest Rated") result = [...result].sort((a, b) => b.rating - a.rating);
    if (sort === "Available Now") result = [...result].sort((a, b) => (a.availability === "Available now" ? -1 : 1) - (b.availability === "Available now" ? -1 : 1));
    if (sort === "Lowest Starting Price") result = [...result].sort((a, b) => a.price - b.price);
    return result;
  }, [activeSearch, location, sort, category]);

  const toggleFavorite = (slug: string) => {
    setFavorites((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug],
    );
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</p>
            <h1 className="mt-1 text-2xl font-black">Find a Provider</h1>
          </div>
          <a href="/" className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300">
            Home
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-3xl border border-white/10 bg-[#121212] p-5">
          <p className="text-xs font-bold tracking-widest text-zinc-500">SEARCH</p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && setActiveSearch(query)}
            type="text"
            placeholder="What service do you need?"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-white outline-none placeholder:text-zinc-600 focus:border-[#D4AF37]/60"
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-white outline-none"
            >
              <option>All Lagos</option>
              <option>Lekki, Lagos</option>
              <option>Victoria Island, Lagos</option>
              <option>Ikeja, Lagos</option>
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-white outline-none"
            >
              <option>Recommended</option>
              <option>Highest Rated</option>
              <option>Available Now</option>
              <option>Lowest Starting Price</option>
            </select>
          </div>

          <button
            onClick={() => setActiveSearch(query)}
            className="mt-4 w-full rounded-2xl bg-[#D4AF37] px-5 py-4 font-bold text-black transition hover:bg-[#E4C04A]"
          >
            Search Providers
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                category === item
                  ? "bg-[#D4AF37] text-black"
                  : "border border-white/10 bg-[#121212] text-zinc-300"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#D4AF37]">VERIFIED PROFESSIONALS</p>
            <h2 className="mt-1 text-2xl font-bold">Available near you</h2>
          </div>
          <span className="text-sm text-zinc-500">{visibleProviders.length} providers</span>
        </div>

        {visibleProviders.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#121212] p-8 text-center">
            <p className="text-xl font-bold">No providers found</p>
            <p className="mt-2 text-zinc-500">Try another service, area or category.</p>
            <button
              onClick={() => {
                setQuery("");
                setActiveSearch("");
                setLocation("All Lagos");
                setCategory("All");
                setSort("Recommended");
              }}
              className="mt-5 rounded-xl bg-[#D4AF37] px-5 py-3 font-bold text-black"
            >
              Reset Search
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleProviders.map((provider) => (
              <article
                key={provider.slug}
                className="rounded-3xl border border-white/10 bg-[#121212] p-5 transition hover:border-[#D4AF37]/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-2xl">👤</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{provider.name}</h3>
                        {provider.verified && (
                          <span className="rounded-full bg-[#D4AF37]/10 px-2 py-1 text-[10px] font-bold text-[#D4AF37]">
                            ✓ VERIFIED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">{provider.category} • {provider.area}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFavorite(provider.slug)}
                    aria-label="Toggle favourite"
                    className="text-2xl"
                  >
                    {favorites.includes(provider.slug) ? "♥" : "♡"}
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-[#1A1A1A] p-3">
                    <p className="text-xs text-zinc-500">Rating</p>
                    <p className="mt-1 font-bold">⭐ {provider.rating}</p>
                  </div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-3">
                    <p className="text-xs text-zinc-500">Jobs</p>
                    <p className="mt-1 font-bold">{provider.jobs}</p>
                  </div>
                  <div className="rounded-2xl bg-[#1A1A1A] p-3">
                    <p className="text-xs text-zinc-500">Price</p>
                    <p className="mt-1 text-sm font-bold">From {money(provider.price)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs text-zinc-500">Availability</p>
                    <p className="mt-1 text-sm font-semibold text-green-400">● {provider.availability}</p>
                  </div>
                  <button
                    onClick={() => setSelectedProvider(provider)}
                    className="rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black"
                  >
                    View Profile
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-6">
          <p className="text-xs font-bold tracking-widest text-red-400">NEED URGENT HELP?</p>
          <h3 className="mt-2 text-xl font-bold">Post your job and let providers respond.</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            Describe what you need, choose your location and mark the request as urgent if you need someone quickly.
          </p>
          <a href="/post-job?urgent=1" className="mt-5 inline-block rounded-xl bg-white px-5 py-3 font-bold text-black">
            Post a Job
          </a>
        </div>
      </section>

      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#121212] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#D4AF37]">PROVIDER PROFILE</p>
                <h2 className="mt-2 text-2xl font-black">{selectedProvider.name}</h2>
                <p className="mt-1 text-zinc-400">{selectedProvider.category} • {selectedProvider.area}</p>
              </div>
              <button onClick={() => setSelectedProvider(null)} className="rounded-full border border-white/10 px-3 py-2">✕</button>
            </div>

            <p className="mt-5 leading-7 text-zinc-300">{selectedProvider.bio}</p>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Rating</p><p className="mt-1 font-bold">⭐ {selectedProvider.rating}</p></div>
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">Jobs</p><p className="mt-1 font-bold">{selectedProvider.jobs}</p></div>
              <div className="rounded-2xl bg-[#1A1A1A] p-3"><p className="text-xs text-zinc-500">From</p><p className="mt-1 font-bold">{money(selectedProvider.price)}</p></div>
            </div>

            <a
              href={`/post-job?provider=${encodeURIComponent(selectedProvider.slug)}`}
              className="mt-6 block rounded-2xl bg-[#D4AF37] px-5 py-4 text-center font-bold text-black"
            >
              Request Service
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
