# Rydah Local Android release

## Approved permanent application ID

`online.rydahlocal.app`

Approved for Rydah Local on 18 September 2026.

Treat this identifier as permanent for the Android/Google Play application. Do not create a second production Android package ID unless the product intentionally becomes a separate app.

## Product identity
- App: Rydah Local
- Package: `online.rydahlocal.app`
- Website: https://rydahlocal.online
- Tagline: Move Smart. Move Rydah.
- Primary launch market: Lagos, Nigeria
- Theme: deep black + premium gold

## Native packaging approach

The current product is a working Next.js application with live backend/authentication, payments and identity-verification flows. The Android release must preserve those live server-backed flows rather than attempting to convert the application into a static export.

The native Android shell should therefore use the approved production origin `https://rydahlocal.online` and add native integrations progressively where needed, including:
- camera/liveness access
- secure authentication/session handling
- notifications
- deep links
- file/photo capture
- payment return links
- Android back navigation
- safe external-link handling

## Google Play build identity
When the Android project is generated:
- namespace: `online.rydahlocal.app`
- applicationId: `online.rydahlocal.app`
- initial versionCode: `1`
- initial versionName: `0.1.0`

Do not upload a production bundle signed with a throwaway key. Configure Google Play App Signing and keep the upload key securely backed up.

## Digital Asset Links
Before enabling verified Android App Links, generate the production signing certificate SHA-256 fingerprint and publish a valid `/.well-known/assetlinks.json` for `online.rydahlocal.app`.

## Before Play production
1. Build and test the Android App Bundle on real Android devices.
2. Test sign-in, password reset, Youverify liveness/camera, job posting, quotes, arrival PIN, payments and payment return.
3. Confirm production Youverify and Paystack configuration.
4. Complete Play Console app-access and data-safety declarations from the actual production behaviour.
5. Upload genuine phone/tablet screenshots and the approved Rydah icon/feature graphic.
6. Submit the release to the applicable Play testing/production track.
