# Rydah Local — Google Play release profile

## Brand
- App name: **Rydah Local**
- Tagline: **Move Smart. Move Rydah.**
- Website: https://rydahlocal.online
- Support: https://rydahlocal.online/support
- Privacy policy: https://rydahlocal.online/privacy
- Account deletion URL: https://rydahlocal.online/delete-account
- Target launch cities: Lagos, Abuja, Ibadan, Warri and Port Harcourt, Nigeria
- Brand colours: Deep Black `#080808`, Premium Gold `#D4AF37`
- App icon source: `/public/rydah-icon.svg`

## Approved Android package name
`online.rydahlocal.app`

**Status: APPROVED.** This is now the canonical Android/Google Play application ID for Rydah Local. Treat it as permanent for production releases.

## Initial release identity
- applicationId / namespace: `online.rydahlocal.app`
- versionCode: `1`
- versionName: `0.1.0`

## Store listing
### App title
Rydah Local

### Short description
Book trusted local professionals and manage safer service jobs across Nigeria.

### Full description
Rydah Local helps customers find and engage trusted local professionals across Lagos, Abuja, Ibadan, Warri and Port Harcourt.

Post a service request, receive provider quotes, review job details and keep the service journey on-platform. Rydah includes provider identity and biometric verification, arrival safety checks, job status tracking, notifications and supported payment flows.

For customers:
- Discover local service providers
- Post standard or urgent service requests
- Review provider quotes before work starts
- Use Arrival PIN and safety checks
- Track active and completed jobs
- Manage supported payments and job history

For service providers:
- Create and verify a professional profile
- Complete identity and biometric verification
- Receive assigned customer requests
- Send job quotes
- Track active work and earnings
- Manage supported settlements and payouts

Rydah Local targets Lagos, Abuja, Ibadan, Warri and Port Harcourt at launch. Availability in each area depends on active, verified provider supply.

Move Smart. Move Rydah.

## Suggested Play category
Business

## Required truthful store assets
Do **not** use mock ratings, review counts, download counts or screenshots that imply features/users that do not exist.

Prepare:
- 512 × 512 PNG app icon
- 1024 × 500 feature graphic
- At least 2 real phone screenshots from the current production app
- Tablet screenshots for large-screen presentation when available
- Privacy-policy URL
- Support contact
- App access/reviewer credentials for authenticated features

## Release readiness
Before production submission:
- Replace Youverify sandbox credentials/permissions with production-ready verification configuration.
- Confirm Paystack production mode and webhook verification.
- Run customer -> quote -> arrival -> start job -> complete -> payment end-to-end testing.
- Confirm account deletion/data request flow and store data-safety answers.
- Test Android camera/liveness, notifications, payments and login recovery on real devices.
- Produce an Android App Bundle (AAB) using `online.rydahlocal.app`.
- Configure Play App Signing and secure the upload key.
- Complete Google Play developer identity/device verification.
- Complete required testing before production if the Play Console account is subject to it.

## Current web/PWA identity
The production web app exposes Rydah Local install metadata, black/gold branding, standalone display mode, and the Rydah icon for supported browsers/devices.


## Google Play payments model
Rydah Local facilitates payment for real-world local services. Google Play's billing system is intended for digital goods/services and is not the payment system for physical services such as transportation, cleaning, food delivery and similar real-world services.

Current release approach:
- Keep Google Play Billing disabled.
- Use the existing Paystack-backed Rydah payment flow for eligible real-world service jobs.
- Do not introduce digital subscriptions, paid digital features or virtual goods without reviewing Play Billing requirements again.
