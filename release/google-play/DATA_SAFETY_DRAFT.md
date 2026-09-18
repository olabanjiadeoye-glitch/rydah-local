# Rydah Local — Google Play Data Safety Draft

> Working draft for Play Console. Review against the production configuration immediately before submission. Do not copy answers blindly if the app's production behaviour changes.

## App identity
- App: Rydah Local
- Android package: `online.rydahlocal.app`
- Website: https://rydahlocal.online
- Privacy policy: https://rydahlocal.online/privacy
- Account deletion resource: https://rydahlocal.online/delete-account

## Security / user controls
- Data is transmitted over HTTPS in production.
- Rydah provides an account-deletion request path in the signed-in app and through a public web resource.
- Passwords are handled by Supabase Auth; Rydah application pages do not store plaintext passwords.
- Payment-card entry is handled by Paystack rather than by Rydah pages.
- Provider identity/liveness checks are handled through Youverify-backed verification flows.
- Rydah should not claim independent security certification unless one has actually been completed.

## Data categories currently relevant

### Personal information
Likely collected:
- Name
- Email address
- Phone number
- User IDs / account identifiers
- Provider business/profile information
- Address/location text supplied for service requests

Purposes:
- Account management
- Marketplace matching and service delivery
- Fraud prevention and safety
- Customer support
- Notifications and transactional communication

### Location
Optional collection:
- Precise device latitude/longitude when a customer explicitly taps **Use My Current Location** while creating a job
- Device-reported location accuracy
- Service-area text selected or suggested from GPS

Purposes:
- Core app functionality
- Matching the job to a supported service area
- Allowing the assigned provider to navigate to an accepted job

Important implementation notes:
- GPS is optional; manual area selection remains available.
- Out-of-coverage GPS positions are not stored with the job.
- Exact customer job coordinates are released only to the assigned provider after quote acceptance.
- Exact provider live GPS coordinates are not published or stored in the public provider marketplace record; provider GPS is used on-device to suggest a service area.

### Financial information
Rydah stores or processes:
- Payment references
- Job amounts / quotes
- Commission and settlement records
- Provider payout/settlement status

Rydah should **not** claim to store full card numbers, CVV or card PINs. Card/payment entry is handled by Paystack.

### Photos / identity verification data
Provider verification may process:
- Live camera/liveness capture through the identity-verification provider
- Identity document / identity-number verification information
- Verification result, status and audit metadata

Production Play disclosure must reflect exactly what Youverify returns to Rydah and what Rydah retains. Current application intent is to retain verification results/audit fields and limited ID information rather than full live selfie material where possible.

### App activity / marketplace data
Collected:
- Jobs/service requests
- Job descriptions
- Provider quotes
- Job status/history
- Notifications
- Favourites / marketplace interactions where persisted
- Support/complaint information
- Safety incident reports and review status
- Payment/service disputes and refund-review status

Purposes:
- Core app functionality
- Safety and fraud prevention
- Customer support
- Marketplace operations
- Financial reconciliation

### Device / session / notification data
May include:
- Authentication/session information
- Browser/device information exposed in normal web requests/logs
- Security/audit metadata
- Web Push subscription endpoint and encryption keys when a user opts in to device notifications

Purposes:
- Account security
- App functionality
- Delivery of job, safety, payment, dispute and verification notifications

Review Supabase, Vercel and any production analytics/logging configuration before answering Play's device identifiers and diagnostics questions.

## Third-party processors / sharing review

### Supabase
Used for authentication, database and backend infrastructure. Treat data sent to Supabase as processing necessary to provide app functionality.

### Paystack
Used for supported online payments and provider settlement/payout flows. Financial transaction data and payment metadata may be sent to Paystack.

### Youverify
Used for identity verification, face matching and liveness checks. Identity and biometric-related data necessary for verification may be sent to Youverify.

### Vercel
Hosts the web application and may process ordinary request/log information needed to deliver the service.

## Ads
Current Rydah product should answer **No ads** unless an advertising SDK or ad placement is intentionally added before release.

## Account creation and deletion
Rydah supports account creation. Google Play therefore requires:
- an in-app account deletion request path; and
- a public web deletion resource.

Current web resource:
https://rydahlocal.online/delete-account

The implemented admin deletion workflow removes the Supabase Auth account, deletes account-linked records where configured to cascade, anonymises retained customer job/provider identity data, and removes the direct user link from retained financial records. Limited transaction, dispute and safety records may remain where reasonably necessary for reconciliation, fraud prevention, safety, legal obligations, or resolving claims.

## Items to verify before final Play answers
1. Production Youverify retention behaviour and DPA / privacy terms.
2. Production Paystack data flows and webhook payloads.
3. Whether any analytics SDK is added before release.
4. Whether crash reporting is added before release.
5. Confirm Google Play's final disclosure wording for optional precise job-location GPS. The production implementation collects GPS only after explicit user action and retains it with the job for accepted-job navigation.
6. Confirm production Web Push delivery behaviour on Android/PWA and whether Play categorises the stored push endpoint as a device or other identifier for the final questionnaire.
7. Exact retention period for completed jobs, payments, disputes, safety incidents and verification audit records.
8. Actual operational SLA used by Rydah support to complete account deletion requests.
9. Whether users can upload job photos or other user-generated files in the production build.
10. Whether any AI assistant conversation content is retained server-side.

## Reviewer access
If Play review requires authentication, provide a dedicated reviewer/test account with enough seeded data to exercise:
- customer marketplace
- job posting
- quote review
- My Jobs
- provider onboarding/verification explanation
- support/privacy/account deletion

Do not provide a real user's credentials or a production admin account to reviewers.
