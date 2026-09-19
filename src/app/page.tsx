import Link from "next/link";
import RydahCareAssistant from "./rydah-care-assistant";
import BrandLogo from "./brand-logo";

const services = [
  { name: "Electrician", icon: "⚡", description: "Electrical repairs & installation", surface: "from-amber-400/15 via-orange-400/5 to-transparent", iconSurface: "bg-amber-400/15" },
  { name: "Plumber", icon: "🔧", description: "Leaks, pipes & plumbing repairs", surface: "from-sky-400/15 via-cyan-400/5 to-transparent", iconSurface: "bg-sky-400/15" },
  { name: "AC Technician", icon: "❄️", description: "AC servicing & repairs", surface: "from-cyan-300/15 via-blue-400/5 to-transparent", iconSurface: "bg-cyan-300/15" },
  { name: "Generator", icon: "🔌", description: "Generator repairs & servicing", surface: "from-violet-400/15 via-fuchsia-400/5 to-transparent", iconSurface: "bg-violet-400/15" },
  { name: "Cleaning", icon: "🧹", description: "Home & professional cleaning", surface: "from-emerald-400/15 via-teal-400/5 to-transparent", iconSurface: "bg-emerald-400/15" },
  { name: "Mechanic", icon: "🚗", description: "Vehicle repairs & roadside help", surface: "from-rose-400/15 via-red-400/5 to-transparent", iconSurface: "bg-rose-400/15" },
];

const trustSteps = [
  { title: "Biometric-verified professionals", text: "Eligible providers complete live camera liveness plus ID face matching before they can receive new Rydah jobs.", accent: "from-violet-500/20 to-fuchsia-500/5", badge: "bg-violet-400" },
  { title: "Quote before work", text: "See and accept the provider quote inside Rydah before work starts.", accent: "from-sky-500/20 to-cyan-500/5", badge: "bg-sky-400" },
  { title: "Arrival safety check", text: "Use the one-time Arrival PIN and provider face matching before work starts.", accent: "from-emerald-500/20 to-teal-500/5", badge: "bg-emerald-400" },
  { title: "Protected payment trail", text: "Use secure Paystack checkout so the job, commission and payment record stay inside Rydah.", accent: "from-amber-500/20 to-orange-500/5", badge: "bg-[#D4AF37]" },
];

const cityCoverage = [
  { city: "Lagos", areas: "Lekki • VI • Ikeja • Ajah • Surulere • Yaba", tone: "from-[#D4AF37]/20 to-amber-950/20" },
  { city: "Abuja", areas: "Wuse • Garki • Maitama • Gwarinpa • Jabi • Kubwa", tone: "from-emerald-500/15 to-emerald-950/20" },
  { city: "Ibadan", areas: "Oluyole • Akala • Jericho • Iyaganku • Bodija • Dugbe", tone: "from-violet-500/15 to-violet-950/20" },
  { city: "Warri", areas: "Central • Effurun • Enerhen • Udu • Ekpan", tone: "from-sky-500/15 to-sky-950/20" },
  { city: "Port Harcourt", areas: "GRA • D-Line • Rumuola • Woji • Trans Amadi", tone: "from-rose-500/15 to-rose-950/20" },
];

const lekkiHeroImage = "https://upload.wikimedia.org/wikipedia/commons/9/94/Lekki_link_bridge.jpg";
const thirdMainlandImage = "https://images.unsplash.com/photo-1691743441282-72dbe8f91dcc?auto=format&fit=crop&fm=jpg&q=82&w=2200";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="Rydah Local home"><BrandLogo /></Link>
          <div className="flex items-center gap-2">
            <Link href="/providers" className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-[#D4AF37]/40 hover:text-white sm:inline-block">Browse</Link>
            <Link href="/sign-in" className="rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/5 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/10">Sign In</Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 scale-[1.02] bg-cover bg-center opacity-95 sm:bg-[center_52%]"
          style={{ backgroundImage: `url('${lekkiHeroImage}')` }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050505]/30 via-[#090909]/45 to-[#080808] sm:from-black/20 sm:via-black/40" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-black/15" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080808] to-transparent" aria-hidden="true" />

        <div className="relative mx-auto flex min-h-[500px] max-w-6xl items-center px-5 py-10 sm:min-h-[560px] sm:py-14">
          <div className="w-full max-w-5xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#D4AF37]/35 bg-black/50 px-4 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.25)] backdrop-blur-md">
              <span className="text-3xl leading-none" role="img" aria-label="Nigeria flag">🇳🇬</span>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#F4D66E]">Built for everyday Nigeria</span>
            </div>

            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.96] tracking-tight drop-shadow-[0_4px_22px_rgba(0,0,0,0.5)] sm:text-7xl lg:text-8xl">
              Trusted local help.
              <span className="block bg-gradient-to-r from-[#FFF2A8] via-[#D4AF37] to-[#F59E0B] bg-clip-text text-transparent">Booked the Rydah way.</span>
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-xl">
              Find verified local professionals, agree the quote, confirm who arrived and keep your payment record protected in one place.
            </p>

            <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
              <Link href="/providers" className="rounded-2xl bg-gradient-to-r from-[#E8C447] to-[#F8DE79] px-5 py-4 text-center text-base font-black text-black shadow-[0_14px_40px_rgba(212,175,55,0.25)] transition hover:-translate-y-0.5">Find a Provider</Link>
              <Link href="/post-job" className="rounded-2xl border border-white/25 bg-black/60 px-5 py-4 text-center text-base font-black text-white backdrop-blur-md transition hover:border-[#D4AF37]/60 hover:bg-black/70">Post a Job</Link>
              <Link href="/sign-in" className="rounded-2xl border border-white/25 bg-white/10 px-5 py-4 text-center text-base font-black text-white backdrop-blur-md transition hover:border-[#D4AF37]/60 hover:bg-white/15">Join Rydah</Link>
            </div>

            <div className="mt-7 grid max-w-4xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-violet-300/20 bg-violet-950/35 p-4 backdrop-blur-md"><p className="text-xs font-black text-violet-200">IDENTITY</p><p className="mt-1 font-bold">Rydah Verified providers</p></div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-950/35 p-4 backdrop-blur-md"><p className="text-xs font-black text-emerald-200">PAYMENTS</p><p className="mt-1 font-bold">Secure Paystack checkout</p></div>
              <div className="rounded-2xl border border-sky-300/20 bg-sky-950/35 p-4 backdrop-blur-md"><p className="text-xs font-black text-sky-200">ARRIVAL</p><p className="mt-1 font-bold">PIN + camera safety checks</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-6 sm:py-8">
        <div className="absolute -left-32 top-6 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />

        <div className="relative mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-widest text-[#D4AF37]">POPULAR SERVICES</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">What do you need done?</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400">Lagos • Abuja • Ibadan • Warri • Port Harcourt</span>
        </div>

        <div className="relative grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.name}
              href={`/providers?category=${encodeURIComponent(service.name)}`}
              className={`group flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br ${service.surface} p-4 transition hover:-translate-y-1 hover:border-[#D4AF37]/45 hover:shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:block sm:rounded-3xl sm:p-6`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${service.iconSurface} text-2xl ring-1 ring-white/10 sm:h-14 sm:w-14 sm:rounded-2xl sm:text-3xl`}>
                {service.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black transition group-hover:text-[#F5D35F] sm:mt-5 sm:text-xl">{service.name}</h3>
                <p className="mt-1 text-sm leading-5 text-zinc-400 sm:mt-2 sm:text-base sm:leading-normal">{service.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="relative mt-6 overflow-hidden rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-r from-[#D4AF37]/12 via-fuchsia-500/5 to-cyan-500/10 p-6 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-black tracking-widest text-[#E8C447]">PROFESSION NOT LISTED?</p>
            <h3 className="mt-2 text-2xl font-black">Rydah is built to grow beyond six trades.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Create a Service Provider account and register your genuine profession and service area for marketplace review.</p>
          </div>
          <Link href="/sign-in" className="mt-5 inline-block shrink-0 rounded-2xl bg-white px-5 py-4 text-sm font-black text-black transition hover:bg-zinc-100 sm:mt-0">Join as a Provider</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-6">
          <p className="text-xs font-black tracking-widest text-[#D4AF37]">GROWING COVERAGE</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">One Rydah experience across more Nigerian cities.</h2>
          <p className="mt-3 max-w-3xl leading-7 text-zinc-400">Provider availability depends on verified supply in each area, but the marketplace is already structured for these locations.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cityCoverage.map((location) => (
            <div key={location.city} className={`rounded-3xl border border-white/10 bg-gradient-to-br ${location.tone} p-6 shadow-[0_16px_42px_rgba(0,0,0,0.16)]`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black">{location.city}</h3>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-[#EAD06A]">RYDAH LOCAL</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">{location.areas}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#101010]">
          <div className="relative min-h-[250px] overflow-hidden sm:min-h-[300px]">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${thirdMainlandImage}')` }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/20" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-transparent" aria-hidden="true" />
            <div className="relative flex min-h-[250px] items-end p-5 sm:p-6 sm:min-h-[300px] sm:p-5">
              <div className="max-w-3xl">
                <p className="text-xs font-black tracking-[0.2em] text-[#F3D56B]">LAGOS ENERGY • NIGERIAN REACH</p>
                <h2 className="mt-3 text-3xl font-black sm:text-5xl">Built to feel local, wherever Rydah grows next.</h2>
                <p className="mt-4 max-w-2xl leading-7 text-zinc-200">From Lagos Mainland to Ibadan, Abuja and beyond, the same Rydah trust flow stays consistent: verified identity, clear quotes, arrival checks and protected payment records.</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-black tracking-widest text-[#D4AF37]">HOW RYDAH PROTECTS THE JOB</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-4xl">Designed to keep trust, identity and payment inside the platform.</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {trustSteps.map((step, index) => (
                <div key={step.title} className={`rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${step.accent} p-4 sm:p-5`}>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${step.badge} text-sm font-black text-black shadow-lg`}>{index + 1}</div>
                  <h3 className="mt-3 text-lg font-black sm:text-xl">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-300 sm:text-base">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-3xl border border-orange-300/20 bg-gradient-to-br from-orange-500/20 via-rose-500/10 to-[#0d0d0d] p-5 sm:p-6 shadow-[0_18px_50px_rgba(249,115,22,0.08)]">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#D4AF37]/15 blur-3xl" aria-hidden="true" />
            <p className="relative text-xs font-black tracking-widest text-amber-300">URGENT HELP</p>
            <h2 className="relative mt-3 text-3xl font-black">Need someone quickly?</h2>
            <p className="relative mt-3 leading-7 text-zinc-300">Post an urgent request and Rydah will look for a suitable verified professional. Rydah Local is not an emergency service.</p>
            <Link href="/post-job?urgent=1" className="relative mt-6 inline-block rounded-2xl bg-gradient-to-r from-[#D4AF37] to-amber-300 px-6 py-4 font-black text-black transition hover:-translate-y-0.5">Request Urgent Help</Link>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-[#0d0d0d] p-5 sm:p-6">
            <div className="absolute -bottom-20 -right-14 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative text-4xl">🛡️</div>
            <p className="relative mt-5 text-xs font-black tracking-widest text-cyan-200">STAY ON RYDAH</p>
            <h2 className="relative mt-3 text-2xl font-black">Protection follows the booking.</h2>
            <p className="relative mt-3 leading-7 text-zinc-300">Keep quotes and payment inside Rydah. Off-platform deals can remove the job record, commission trail and Rydah support context that help resolve problems.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-6 sm:py-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-500/15 via-[#17130a] to-emerald-500/10 p-5 sm:p-6">
          <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" aria-hidden="true" />
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-widest text-[#E2C55C]">RYDAH CARE</p>
              <h2 className="mt-2 text-3xl font-black">Need help choosing the next step?</h2>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-300">The Rydah Care assistant can explain bookings, payments, provider verification, arrival checks, cancellations and provider registration. Use the chat button on this page.</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/15 px-5 py-4 text-sm font-black text-emerald-200 backdrop-blur-sm">● Customer care available</div>
          </div>
        </div>
      </section>

      <footer className="mt-6 border-t border-white/10 bg-gradient-to-b from-[#090909] to-black px-5 py-6 text-center">
        <div className="flex justify-center"><BrandLogo /></div>
        <p className="mt-3 text-sm text-zinc-500">Trusted local help. Booked the Rydah way.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <Link href="/support" className="text-[#D4AF37]">Support</Link>
          <Link href="/privacy" className="text-zinc-400">Privacy</Link>
          <Link href="/terms" className="text-zinc-400">Terms</Link>
          <a href="mailto:admin@rydahlocal.online" className="text-zinc-400">admin@rydahlocal.online</a>
        </div>
        <p className="mt-5 text-sm text-zinc-700">© 2026 Rydah Local</p>
        <p className="mx-auto mt-4 max-w-3xl text-[10px] leading-4 text-zinc-700">
          Bridge imagery: Lekki–Ikoyi Link Bridge by Olasunkanmiariyo via Wikimedia Commons (CC BY-SA 4.0); Third Mainland Bridge by Jesse-Maurice Iyoha via Unsplash.
        </p>
      </footer>

      <RydahCareAssistant />
    </main>
  );
}
