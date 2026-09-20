# Rydah Local launch reality checklist

This checklist converts customer-facing launch concerns into product and operational controls. It is intentionally strict: no fake ratings, fake provider availability, invented arrival times or sandbox revenue should be presented as real.

## Customer availability
- Marketplace only lists verified, biometric-verified providers marked available.
- Provider cards say "Available for Rydah jobs", not "available now".
- Travel time is not promised from a service-area listing.
- Admin dashboard tracks available verified providers by city.
- Internal pilot threshold: 20 available verified providers in a city before heavy customer marketing.

## Trust and reviews
- Provider cards identify biometric verification explicitly.
- Ratings and completed-job counts come from real completed-job review/job data.
- New providers show "New provider" instead of a fabricated-looking 0.0 rating.
- Public provider modal exposes only sanitized completed-job review summaries and recent comments; customer identity is not exposed.

## Nigerian addressing
- Job requests accept an optional nearest landmark / estate / junction.
- Landmark, phone, email and precise GPS remain private from the provider until quote acceptance.
- Manual service-area selection remains available when GPS is unavailable or unwanted.

## Quote and off-platform protection
- Customer is reminded that the Rydah quote is the recorded agreed price.
- Changed scope should use a revised in-app quote instead of phone/WhatsApp side agreements.
- Job descriptions block external contact details.
- Payment guidance warns against moving an in-app booking to a provider's personal transfer route.

## Payment expectations
- Paystack remains the protected digital route.
- Cash is limited to eligible jobs of ₦5,000 or less.
- Sandbox/test transactions are excluded from live GMV and revenue reporting.

## Provider response
- Assigned providers receive job notifications and the provider alert tone.
- Customer job tracking shows when the provider has been alerted and a quote is still pending.
- Jobs now record first quote time.
- Admin dashboard tracks average first-quote response time and active requests waiting more than 15 minutes.

## Disputes and evidence
- Resolution Centre is job/payment linked.
- Customers are told what useful evidence to preserve: before/after photos, receipts, part packaging/serials and the recorded Rydah quote.
- Payment/safety/dispute cases have an explicit human-support escalation path.

## Mobile and data
- Welcome and secondary city imagery use reduced image sizes/quality compared with earlier builds.
- Core booking, provider, quote, GPS and payment controls remain text-first and usable without decorative imagery.
- Reduced-motion preferences are respected for welcome/attention animations.

## Welcome/navigation
- Welcome shortcuts are functional.
- Browser Back and refresh can return to the welcome screen.
- Get Started reveals the normal homepage without replacing or duplicating the core booking routes.

## Operational items that code cannot fake
- Recruit, verify and activate genuine providers city by city.
- Test real customer -> quote -> arrival -> work -> payment journeys on real devices.
- Confirm production Paystack credentials/webhook before enabling live collection.
- Confirm production Youverify credentials/permissions.
- Enable leaked-password protection in Supabase Auth.
- Finish Play Console signing/app-link verification and production submission.
- Establish response-time and support staffing expectations using real pilot data.
