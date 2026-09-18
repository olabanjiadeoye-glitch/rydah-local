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

Purposes:
- Core app functionality
- Safety and fraud prevention
- Customer support
- Marketplace operations
- Financial reconciliation

### Device / session data
May include:
- Authentication/session information
- Browser/device information exposed in normal web requests/logs
- Security/audit metadata

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

Deletion requests must result in deletion of associated user data, except limited records that Rydah is legally permitted or required to retain. Any such retention must be described accurately in the privacy notice.

## Items to verify before final Play answers
1. Production Youverify retention behaviour and DPA / privacy terms.
2. Production Paystack data flows and webhook payloads.
3. Whether any analytics SDK is added before release.
4. Whether crash reporting is added before release.
5. Whether precise location/GPS is collected or only user-entered service area/location text.
6. Whether push notification tokens/device identifiers are stored after native notification integration.
7. Exact retention period for completed jobs, payments, disputes and verification audit records.
8. Actual process/SLA used by Rydah support to complete account deletion requests.
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
