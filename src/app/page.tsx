const services = [
  { name: "Electrician", icon: "⚡", description: "Electrical repairs & installation" },
  { name: "Plumber", icon: "🔧", description: "Leaks, pipes & plumbing repairs" },
  { name: "AC Technician", icon: "❄️", description: "AC servicing & repairs" },
  { name: "Generator", icon: "🔌", description: "Generator repairs & servicing" },
  { name: "Cleaning", icon: "🧹", description: "Home & professional cleaning" },
  { name: "Mechanic", icon: "🚗", description: "Vehicle repairs & roadside help" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <a href="/" className="text-xl font-black tracking-tight">
            RYDAH <span className="text-[#D4AF37]">LOCAL</span>
          </a>
          <a
            href="/sign-in"
            className="rounded-full border border-[#D4AF37]/50 px-5 py-2.5 font-semibold text-[#D4AF37]"
          >
            Sign In
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="inline-flex rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-bold tracking-wider text-[#D4AF37]">
          ● NOW LAUNCHING IN LAGOS
        </div>

        <h1 className="mt-8 max-w-4xl text-5xl font-black leading-tight sm:text-7xl">
          Your Local Help,
          <span className="block text-[#D4AF37]">One Tap Away.</span>
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-400">
          Find trusted local professionals or post what you need and let verified providers come to you.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[#121212] p-5">
          <p className="text-xs font-bold tracking-widest text-zinc-500">YOUR LOCATION</p>
          <select
            defaultValue="Lekki, Lagos"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-[#1A1A1A] px-4 py-4 text-white outline-none"
          >
            <option>Lekki, Lagos</option>
            <option>Victoria Island, Lagos</option>
            <option>Ikeja, Lagos</option>
          </select>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <a
            href="/providers"
            className="rounded-2xl bg-[#D4AF37] px-5 py-4 text-center text-lg font-bold text-black transition hover:bg-[#E4C04A]"
          >
            Find a Provider
          </a>
          <a
            href="/post-job"
            className="rounded-2xl border border-white/15 bg-[#121212] px-5 py-4 text-center text-lg font-bold text-white transition hover:border-[#D4AF37]/50"
          >
            Post a Job
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#D4AF37]">SERVICES</p>
            <h2 className="mt-2 text-3xl font-black">What do you need?</h2>
          </div>
          <span className="text-zinc-500">Lagos</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <a
              key={service.name}
              href={`/providers?category=${encodeURIComponent(service.name)}`}
              className="rounded-3xl border border-white/10 bg-[#121212] p-6 transition hover:border-[#D4AF37]/50"
            >
              <div className="text-4xl">{service.icon}</div>
              <h3 className="mt-5 text-xl font-bold">{service.name}</h3>
              <p className="mt-2 text-zinc-500">{service.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-8">
          <p className="text-xs font-bold tracking-widest text-red-400">URGENT HELP</p>
          <h2 className="mt-3 text-3xl font-black">Need someone quickly?</h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
            Post an urgent request and connect with suitable verified professionals in your area. Rydah Local is not an emergency service.
          </p>
          <a
            href="/post-job?urgent=1"
            className="mt-6 inline-block rounded-2xl bg-white px-6 py-4 font-bold text-black"
          >
            Request Urgent Help
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#121212] p-8">
          <div className="text-4xl">🛡️</div>
          <p className="mt-5 text-xs font-bold tracking-widest text-[#D4AF37]">RYDAH VERIFIED</p>
          <h2 className="mt-3 text-2xl font-black">Trust starts with verification.</h2>
          <p className="mt-3 leading-7 text-zinc-400">
            Providers displaying the Rydah Verified badge have completed Rydah&apos;s required identity and profile verification checks.
          </p>
        </div>
      </section>

      <footer className="mt-10 border-t border-white/10 px-5 py-10 text-center">
        <p className="font-black">RYDAH <span className="text-[#D4AF37]">LOCAL</span></p>
        <p className="mt-3 text-sm text-zinc-600">Your Local Help, One Tap Away.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <a href="/support" className="text-[#D4AF37]">Support</a>
          <a href="/privacy" className="text-zinc-400">Privacy</a>
          <a href="/terms" className="text-zinc-400">Terms</a>
          <a href="mailto:admin@rydahlocal.online" className="text-zinc-400">admin@rydahlocal.online</a>
        </div>
        <p className="mt-5 text-sm text-zinc-700">© 2026 Rydah Local</p>
      </footer>
    </main>
  );
}
