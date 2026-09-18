export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-5 py-7 sm:py-6 text-white">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-black tracking-[0.2em] text-[#D4AF37]">RYDAH LOCAL</a>
        <h1 className="mt-4 text-4xl font-black">Privacy Notice</h1>
        <p className="mt-3 text-sm text-zinc-500">Effective: 18 September 2026</p>

        <div className="mt-6 space-y-8 text-sm leading-7 text-zinc-300">
          <section>
            <h2 className="text-xl font-black text-white">What we collect</h2>
            <p className="mt-2">Rydah Local may collect account details, contact information, job and service information, transaction records, provider profile and verification information, device/session information, profession-interest submissions, and support communications needed to operate the marketplace.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Identity and face verification</h2>
            <p className="mt-2">Where provider verification is required, the full ID number and face image are sent securely to our identity-verification provider for the verification request. Rydah Local is designed to retain only the last four characters of the ID, the verification status/result, related timestamps, and provider reference information rather than the full ID number or enrolment selfie.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Provider biometric verification</h2>
            <p className="mt-2">Provider verification may use a live camera liveness session and face-to-ID matching through Rydah&apos;s identity-verification provider. The verification provider may process live face images or video required to perform the check. Rydah is designed to retain the verification outcome, provider session reference, timestamps and limited audit information rather than the raw liveness image or video itself. Providers must consent before starting this check.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Arrival camera checks</h2>
            <p className="mt-2">For providers who have completed supported biometric enrolment, a customer may use a phone camera during an active job arrival check to compare the person present with the provider&apos;s verified reference. The camera image is transmitted for the comparison and Rydah is designed to retain the match result, confidence information, timestamps, and audit details rather than the arrival camera image itself.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Optional GPS location</h2>
            <p className="mt-2">When a customer explicitly taps the GPS option while creating a job, Rydah may store the device latitude, longitude, reported accuracy and timestamp with that job so the assigned provider can navigate to the service location after the customer accepts the quote. GPS is optional and manual service-area selection remains available. Exact provider live coordinates are not published in the marketplace; provider GPS is used on-device to suggest a service area.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Safety reports and disputes</h2>
            <p className="mt-2">If you use the Safety Center or Resolution Centre, Rydah stores the related job reference, report or dispute category, the description you provide, review status, support responses, and limited audit information. Safety and dispute records may be retained where reasonably necessary for user protection, fraud prevention, transaction handling, legal obligations, or resolving complaints.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Device notifications</h2>
            <p className="mt-2">If you opt in to device notifications, Rydah stores a browser push-subscription endpoint and cryptographic subscription keys associated with your account so job, safety, payment, dispute, and verification updates can be delivered to that device. You can disable notifications for a device from the Notifications page. Push subscription data is removed when the related account is deleted.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Payments, provider billing and commission</h2>
            <p className="mt-2">Online payments, provider registration fees, monthly provider subscriptions and eligible provider commission settlements are processed by Paystack. For the monthly provider subscription, the provider is redirected to Paystack to approve a Nigerian bank Direct Debit mandate. Rydah stores billing status and limited Paystack references needed to manage the subscription, such as mandate, customer and subscription identifiers; Rydah does not ask providers to enter their full Direct Debit bank credentials into Rydah pages.</p>
            <p className="mt-2">Rydah Local does not ask users to enter card details directly into Rydah pages. Payment, billing and settlement records may be retained so we can reconcile registrations, subscriptions, jobs, commissions, provider earnings, disputes, chargebacks, refunds, failed recurring payments and support requests.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Rydah Care assistant</h2>
            <p className="mt-2">Messages sent to Rydah Care may be processed to provide automated customer-support guidance. When an AI service is enabled, the message and a limited amount of recent conversation context may be sent to the AI service to generate a response. Do not submit passwords, one-time passwords, payment-card secrets, API keys, full government identification numbers, or other sensitive secrets through the assistant.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">How we use information</h2>
            <p className="mt-2">We use information to create and secure accounts, match customers with providers, process jobs and payments, support optional job-location navigation, verify providers, conduct arrival safety checks, deliver opted-in device notifications, investigate safety reports and disputes, prevent off-platform abuse and fraud, support marketplace operations, provide customer care, maintain records, improve the service, and comply with legal or regulatory obligations.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Service providers</h2>
            <p className="mt-2">We use specialist providers to operate parts of Rydah Local, including payment processing, hosting/database services, identity verification, email delivery, and, when enabled, AI-assisted customer support. These providers process information according to their services and applicable contractual or legal requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Retention and security</h2>
            <p className="mt-2">We retain information only for as long as reasonably needed for the purposes described above, transaction and safety records, dispute handling, fraud prevention, and applicable legal obligations. We use access controls, encrypted connections, restricted backend credentials, row-level database controls, and other reasonable safeguards, but no online service can guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Your choices and rights</h2>
            <p className="mt-2">Depending on applicable law, you may have rights to request access, correction, deletion, restriction, objection, or information about the handling of your personal data. When an account deletion is completed, Rydah removes the authentication account and anonymises retained job/provider personal information. Limited transaction, dispute and safety audit records may remain where reasonably necessary for financial reconciliation, fraud prevention, safety, legal obligations, or resolving claims.</p>
            <p className="mt-3">To request deletion of your Rydah account and associated personal data, use our <a className="font-bold text-[#D4AF37]" href="/delete-account">account deletion page</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white">Contact</h2>
            <p className="mt-2">For privacy questions or requests, email <a className="font-bold text-[#D4AF37]" href="mailto:admin@rydahlocal.online">admin@rydahlocal.online</a>.</p>
          </section>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <a href="/terms" className="rounded-xl border border-white/15 px-4 py-2 font-bold">Terms</a>
          <a href="/support" className="rounded-xl border border-[#D4AF37]/40 px-4 py-2 font-bold text-[#D4AF37]">Support</a>
          <a href="/" className="rounded-xl bg-[#D4AF37] px-4 py-2 font-bold text-black">Home</a>
        </div>
      </article>
    </main>
  );
}
