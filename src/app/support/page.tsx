import Link from "next/link";
export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-5 py-6 sm:py-8 text-white">
      <section className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-black tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</Link>
        <h1 className="mt-4 text-4xl font-black">Support</h1>
        <p className="mt-3 max-w-2xl leading-7 text-zinc-400">Need help with your account, a job, provider verification, payment, settlement, or a complaint? Rydah Care can guide you, and payment, safety and dispute cases can be escalated for human review.</p>

        <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.18em] text-emerald-300">HUMAN SUPPORT ESCALATION</p>
          <h2 className="mt-2 text-xl font-black">Money and safety problems are not left to the assistant alone.</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">For payment disputes, provider identity concerns, unsafe behaviour or a serious service complaint, open the Resolution Centre or email Rydah support. Include the job reference so a human reviewer can follow the recorded quote, arrival, payment and dispute trail.</p>
        </div>

        <div className="mt-6 rounded-3xl border border-[#D4AF37]/25 bg-[#121212] p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.18em] text-[#D4AF37]">OFFICIAL EMAIL</p>
          <a href="mailto:admin@rydahlocal.online?subject=Rydah%20Support%20Request" className="mt-3 block break-all text-2xl font-black text-white">admin@rydahlocal.online</a>
          <p className="mt-3 text-sm leading-6 text-zinc-400">When contacting us about a payment or job, include the job reference or payment reference where available. Do not email card details, passwords, full ID numbers, or other secrets.</p>
        </div>

        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-950/20 p-5 sm:p-6">
          <h2 className="text-xl font-black">Safety & emergency notice</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Rydah Local is not an emergency service. If there is an immediate threat to life, safety, or property, contact the appropriate emergency services.</p>
          <Link href="/safety" className="mt-4 inline-flex rounded-xl border border-red-500/30 px-4 py-2 text-sm font-black text-red-200">Open Safety Center</Link>
        </div>

        <div className="mt-6 rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5 sm:p-6">
          <h2 className="text-xl font-black">Service or payment problem?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">Open a job-linked dispute in the Rydah Resolution Centre. Refund requests are reviewed before any money movement is attempted.</p>
          <Link href="/disputes" className="mt-4 inline-flex rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-black text-black">Open Resolution Centre</Link>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/privacy" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Privacy</Link>
          <Link href="/terms" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Terms</Link>
          <Link href="/delete-account" className="rounded-xl border border-red-500/30 px-4 py-2 font-bold text-red-300">Delete Account</Link>
          <Link href="/" className="rounded-xl bg-[#D4AF37] px-4 py-2 font-bold text-black">Home</Link>
        </div>
      </section>
    </main>
  );
}
