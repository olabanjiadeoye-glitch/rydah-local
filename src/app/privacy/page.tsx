export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-white">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-black tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</a>
        <h1 className="mt-4 text-4xl font-black">Privacy Notice</h1>
        <p className="mt-3 text-sm text-zinc-500">Effective: 16 September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">What we collect</h2>
            <p className="mt-2">Rydah Local may collect account details, contact information, job and service information, transaction records, provider profile and verification information, device/session information, and support communications needed to operate the marketplace.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Identity and face verification</h2>
            <p className="mt-2">Where provider verification is required, the full ID number and face image are sent securely to our identity-verification provider for the verification request. Rydah Local is designed to retain only the last four characters of the ID, the verification status/result, related timestamps, and provider reference information rather than the full ID number or face image.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Payments</h2>
            <p className="mt-2">Online payments are processed by Paystack. Rydah Local does not ask customers to enter card details directly into Rydah pages. Payment and settlement records may be retained so we can reconcile jobs, commissions, provider earnings, disputes, and support requests.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">How we use information</h2>
            <p className="mt-2">We use information to create and secure accounts, match customers with providers, process jobs and payments, verify providers, prevent abuse and fraud, provide support, maintain records, improve the service, and comply with legal or regulatory obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Service providers</h2>
            <p className="mt-2">We use specialist providers to operate parts of Rydah Local, including payment processing, hosting/database services, identity verification, and email. These providers process information according to their services and applicable contractual or legal requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Retention and security</h2>
            <p className="mt-2">We retain information only for as long as reasonably needed for the purposes described above, transaction and safety records, dispute handling, and applicable legal obligations. We use access controls, encrypted connections, restricted backend credentials, and other reasonable safeguards, but no online service can guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Your choices and rights</h2>
            <p className="mt-2">Depending on applicable law, you may have rights to request access, correction, deletion, restriction, objection, or information about the handling of your personal data. Some records may need to be retained where required for transactions, fraud prevention, disputes, or legal obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Contact</h2>
            <p className="mt-2">For privacy questions or requests, email <a className="font-bold text-[#D4AF37]" href="mailto:admin@rydahlocal.online">admin@rydahlocal.online</a>.</p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href="/terms" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Terms</a>
          <a href="/support" className="rounded-xl border border-[#D4AF37]/40 px-4 py-2 font-bold text-[#D4AF37]">Support</a>
          <a href="/" className="rounded-xl bg-[#D4AF37] px-4 py-2 font-bold text-black">Home</a>
        </div>
      </article>
    </main>
  );
}
