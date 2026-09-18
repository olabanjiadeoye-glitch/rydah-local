export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-5 py-10 text-white">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-black tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</a>
        <h1 className="mt-4 text-4xl font-black">Terms of Use</h1>
        <p className="mt-3 text-sm text-zinc-500">Effective: 18 September 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">Marketplace service</h2>
            <p className="mt-2">Rydah Local is a marketplace that helps customers find and engage local service providers. Providers are responsible for the services they offer, the accuracy of their profile information, and performing agreed work safely, lawfully, and professionally.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Accounts and verification</h2>
            <p className="mt-2">Users must provide accurate information and keep account access secure. Provider verification is intended to improve trust and reduce impersonation, but a verification badge is not a guarantee of skill, availability, suitability, or future conduct. Rydah may suspend or remove accounts where information appears false, unsafe, abusive, fraudulent, or in breach of these terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Jobs, contact details, and on-platform booking</h2>
            <p className="mt-2">Customers and providers are responsible for confirming the scope, timing, price, access requirements, materials, and other job details before work begins. Rydah may restrict contact details and external links until appropriate stages of a booking. Users must not use Rydah primarily to obtain leads and then deliberately move the same job off-platform to avoid Rydah fees, safety controls, records, or commission. Users should not use Rydah Local for unlawful, dangerous, or prohibited activities.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Provider registration, subscription, payments, cash, and commission</h2>
            <p className="mt-2">Service providers are charged a one-time ₦500 registration fee and a ₦500 monthly provider subscription. The monthly subscription is collected through an approved Nigerian bank Direct Debit mandate where supported by the provider&apos;s bank. Providers must keep the subscription active to remain available for new Rydah jobs. If a recurring debit fails, is revoked, or the subscription becomes inactive, Rydah may take the provider profile offline until billing is restored.</p>
            <p className="mt-2">Where online job payment is offered, payments are processed through Paystack. Rydah Local currently applies a 15% platform commission to eligible provider earnings. The customer-facing job price and provider settlement amount are shown where applicable. When an eligible customer selects cash, the related Rydah commission remains payable by the provider. Rydah may temporarily restrict new job acceptance when a provider reaches a stated unpaid cash-commission threshold until that commission is settled. Payment processor fees, reversals, refunds, disputes, chargebacks, and settlement timing may affect final amounts and availability.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Arrival and safety checks</h2>
            <p className="mt-2">Rydah may provide one-time arrival codes and identity or face-matching checks to help confirm that the assigned provider is the person who arrived. These controls reduce risk but cannot eliminate it. Use reasonable judgment when meeting or admitting another user to a property. Rydah Local is not an emergency service. If there is an immediate threat to life, safety, or property, contact the appropriate emergency services rather than relying on the marketplace.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Rydah Care assistant</h2>
            <p className="mt-2">Rydah Care provides general navigation and customer-support guidance. It may use automated or AI-assisted responses. It does not replace human review for payment disputes, refunds, identity concerns, emergencies, or legal matters. Users should never submit passwords, one-time passwords, card PINs, full payment-card details, API keys, NINs, passport numbers, or other secrets through the assistant.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Cancellations, complaints, disputes, and refunds</h2>
            <p className="mt-2">Where a job is cancelled, disputed, incomplete, unsafe, or materially different from what was agreed, users may submit a job-linked report through the Safety Center or Resolution Centre. Rydah may review job, payment, verification, safety, and support records and may request supporting information. Submitting a refund request does not move money automatically: authorised Rydah review is required, and any refund, reversal, or account adjustment depends on the facts of the transaction, payment-processor rules, and applicable law.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Notifications</h2>
            <p className="mt-2">Users may opt in to device notifications for important job, safety, payment, dispute, and verification updates. Notification delivery depends on the user&apos;s device, browser, operating system, network, and notification permissions and therefore cannot be guaranteed.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Liability</h2>
            <p className="mt-2">To the extent permitted by applicable law, Rydah Local provides the marketplace and related technology without guaranteeing uninterrupted availability or the quality of third-party services. Nothing in these terms excludes rights or liabilities that cannot lawfully be excluded.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Changes and contact</h2>
            <p className="mt-2">We may update these terms as the service develops. Material changes will be reflected on this page. Questions can be sent to <a className="font-bold text-[#D4AF37]" href="mailto:admin@rydahlocal.online">admin@rydahlocal.online</a>.</p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href="/privacy" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Privacy</a>
          <a href="/support" className="rounded-xl border border-[#D4AF37]/40 px-4 py-2 font-bold text-[#D4AF37]">Support</a>
          <a href="/" className="rounded-xl bg-[#D4AF37] px-4 py-2 font-bold text-black">Home</a>
        </div>
      </article>
    </main>
  );
}
