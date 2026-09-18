import RydahCareAssistant from "./rydah-care-assistant";
import BrandLogo from "./brand-logo";

const services = [
  { name: "Electrician", icon: "⚡", description: "Electrical repairs & installation" },
  { name: "Plumber", icon: "🔧", description: "Leaks, pipes & plumbing repairs" },
  { name: "AC Technician", icon: "❄️", description: "AC servicing & repairs" },
  { name: "Generator", icon: "🔌", description: "Generator repairs & servicing" },
  { name: "Cleaning", icon: "🧹", description: "Home & professional cleaning" },
  { name: "Mechanic", icon: "🚗", description: "Vehicle repairs & roadside help" },
];

const trustSteps = [
  { title: "Biometric-verified professionals", text: "Eligible providers complete live camera liveness plus ID face matching before they can receive new Rydah jobs." },
  { title: "Quote before work", text: "See and accept the provider quote inside Rydah before work starts." },
  { title: "Arrival safety check", text: "Use the one-time Arrival PIN and provider face matching before work starts." },
  { title: "Protected payment trail", text: "Use secure Paystack checkout so the job, commission and payment record stay inside Rydah." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" aria-label="Rydah Local home"><BrandLogo /></a>
          <div className="flex items-center gap-2">
            <a href="/providers" className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 sm:inline-block">Browse</a>
            <a href="/sign-in" className="rounded-full border border-[#D4AF37]/50 px-5 py-2.5 text-sm font-semibold text-[#D4AF37]">Sign In</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-black tracking-wider text-[#D4AF37]">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> NOW LAUNCHING IN LAGOS
          </div>

          <h1 className="mt-8 max-w-5xl text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl lg:text-8xl">
            Trusted local help.
            <span className="block text-[#D4AF37]">Booked the Rydah way.</span>
          </h1>

          <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-400 sm:text-xl">
            Find verified local professionals, agree the quote, confirm who arrived and keep your payment record protected in one place.
          </p>

          <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
            <a href="/providers" className="rounded-2xl bg-[#D4AF37] px-5 py-4 text-center text-base font-black text-black transition hover:bg-[#E4C04A]">Find a Provider</a>
            <a href="/post-job" className="rounded-2xl border border-white/15 bg-[#121212] px-5 py-4 text-center text-base font-black text-white transition hover:border-[#D4AF37]/50">Post a Job</a>
            <a href="/sign-in" className="rounded-2xl border border-white/15 px-5 py-4 text-center text-base font-black text-zinc-300 transition hover:border-[#D4AF37]/50">Join Rydah</a>
          </div>

          <div className="mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black text-[#D4AF37]">IDENTITY</p><p className="mt-1 font-bold">Rydah Verified providers</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black text-[#D4AF37]">PAYMENTS</p><p className="mt-1 font-bold">Secure Paystack checkout</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs font-black text-[#D4AF37]">ARRIVAL</p><p className="mt-1 font-bold">PIN + camera safety checks</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-widest text-[#D4AF37]">POPULAR SERVICES</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">What do you need done?</h2>
          </div>
          <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-500">Lagos launch marketplace</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <a key={service.name} href={`/providers?category=${encodeURIComponent(service.name)}`} className="group rounded-3xl border border-white/10 bg-[#121212] p-6 transition hover:-translate-y-1 hover:border-[#D4AF37]/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-3xl">{service.icon}</div>
              <h3 className="mt-5 text-xl font-black group-hover:text-[#D4AF37]">{service.name}</h3>
              <p className="mt-2 text-zinc-500">{service.description}</p>
            </a>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-black tracking-widest text-[#D4AF37]">PROFESSION NOT LISTED?</p>
            <h3 className="mt-2 text-2xl font-black">Rydah is built to grow beyond six trades.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Create a Service Provider account and register your genuine profession and Lagos service area for marketplace review.</p>
          </div>
          <a href="/sign-in" className="mt-5 inline-block shrink-0 rounded-2xl bg-white px-5 py-4 text-sm font-black text-black sm:mt-0">Join as a Provider</a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="rounded-[2rem] border border-white/10 bg-[#101010] p-7 sm:p-10">
          <p className="text-xs font-black tracking-widest text-[#D4AF37]">HOW RYDAH PROTECTS THE JOB</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-4xl">Designed to keep trust, identity and payment inside the platform.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {trustSteps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-[#151515] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4AF37] text-sm font-black text-black">{index + 1}</div>
                <h3 className="mt-4 text-xl font-black">{step.title}</h3>
                <p className="mt-2 leading-7 text-zinc-400">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-red-500/20 bg-red-950/20 p-8">
            <p className="text-xs font-black tracking-widest text-red-400">URGENT HELP</p>
            <h2 className="mt-3 text-3xl font-black">Need someone quickly?</h2>
            <p className="mt-3 leading-7 text-zinc-400">Post an urgent request and Rydah will look for a suitable verified professional. Rydah Local is not an emergency service.</p>
            <a href="/post-job?urgent=1" className="mt-6 inline-block rounded-2xl bg-white px-6 py-4 font-black text-black">Request Urgent Help</a>
          </div>

          <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#121212] p-8">
            <div className="text-4xl">🛡️</div>
            <p className="mt-5 text-xs font-black tracking-widest text-[#D4AF37]">STAY ON RYDAH</p>
            <h2 className="mt-3 text-2xl font-black">Protection follows the booking.</h2>
            <p className="mt-3 leading-7 text-zinc-400">Keep quotes and payment inside Rydah. Off-platform deals can remove the job record, commission trail and Rydah support context that help resolve problems.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-[2rem] border border-[#D4AF37]/25 bg-gradient-to-br from-[#17130a] to-[#0d0d0d] p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-widest text-[#D4AF37]">RYDAH CARE</p>
              <h2 className="mt-2 text-3xl font-black">Need help choosing the next step?</h2>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-400">The Rydah Care assistant can explain bookings, payments, provider verification, arrival checks, cancellations and provider registration. Use the chat button on this page.</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-black text-emerald-300">● Customer care available</div>
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-white/10 px-5 py-12 text-center">
        <div className="flex justify-center"><BrandLogo /></div>
        <p className="mt-3 text-sm text-zinc-600">Trusted local help. Booked the Rydah way.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
          <a href="/support" className="text-[#D4AF37]">Support</a>
          <a href="/privacy" className="text-zinc-400">Privacy</a>
          <a href="/terms" className="text-zinc-400">Terms</a>
          <a href="mailto:admin@rydahlocal.online" className="text-zinc-400">admin@rydahlocal.online</a>
        </div>
        <p className="mt-5 text-sm text-zinc-700">© 2026 Rydah Local</p>
      </footer>

      <RydahCareAssistant />
    </main>
  );
}
