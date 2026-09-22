# Rydah Local — Google Play Data Safety Working Answers

Prepared: 22 September 2026

> This is the release working sheet for Play Console. It is based on the current Rydah Local production code and privacy notice. Recheck third-party processor terms and the final production configuration immediately before submission.

## App identity
- App: Rydah Local
- Android package: `online.rydahlocal.app`
- Website: https://rydahlocal.online
- Privacy policy: https://rydahlocal.online/privacy
- Account deletion: https://rydahlocal.online/delete-account

## Top-level Play answers
- **Does the app collect or share required user data types?** Yes.
- **Is all user data encrypted in transit?** Yes — production traffic uses HTTPS/TLS.
- **Can users request deletion of their data?** Yes.
- **Does the app support account creation?** Yes.
- **In-app account deletion path available?** Yes.
- **Public account-deletion web resource available?** Yes.
- **Contains ads?** No.
- **Independent security certification?** No claim should be made unless a real certification is completed.

## Data types to declare

### Personal info
**Collected**
- Name
- Email address
- Phone number
- User/account ID
- Customer service address / location text
- Provider profile/business information
- Other personal info needed for provider identity verification

**Purposes**
- Account management
- App functionality / service delivery
- Fraud prevention, security and compliance
- Customer support
- Transactional communications

### Location
**Collected optionally**
- Precise latitude/longitude
- Reported location accuracy
- Service-area selection/suggestion

The customer explicitly chooses **Use My Current Location** when posting a job. Manual area selection remains available. Exact provider live GPS is not published in the marketplace.

**Purposes**
- App functionality
- Service-area matching
- Navigation to an accepted job

### Financial info
Rydah processes/stores:
- Job quote/amount
- Payment reference and status
- Commission records
- Provider billing / subscription status
- Settlement and payout status

**Do not declare Rydah as storing**
- Full card number
- CVV
- Card PIN

Card entry is handled by Paystack.

### Photos and videos / identity verification
Provider verification and arrival safety checks may transmit:
- live camera/liveness images or video,
- face-match material,
- identity-document or identity-number verification information.

Current Rydah design retains verification status/results, provider/session references, timestamps and limited audit information rather than raw liveness video where possible. The full production disclosure must match the actual Youverify response/retention contract.

**Purposes**
- Fraud prevention and security
- Provider identity verification
- Core marketplace safety functionality

### App activity / user-generated content
Collected:
- Jobs/service requests
- Job descriptions
- Provider quotes
- Job status/history
- Favourites/marketplace interactions where persisted
- Reviews
- Safety reports
- Disputes and support descriptions
- Rydah Care support messages when submitted
- Notification history where persisted

**Purposes**
- App functionality
- Safety/fraud prevention
- Customer support
- Marketplace operations
- Financial reconciliation

### Device or other identifiers / session information
May include:
- Authentication/session identifiers
- Normal browser/request metadata
- Web Push subscription endpoint and cryptographic subscription keys when notifications are enabled
- Security/audit metadata

**Purposes**
- Account security
- App functionality
- Push notifications
- Abuse prevention

### Diagnostics
Do not declare crash-reporting SDK data unless such a service is actually added. Recheck Vercel/Supabase operational logging before final submission to determine whether any Play-defined diagnostics category applies.

## Third parties / processors

### Supabase
Authentication, database and backend infrastructure.

### Paystack
Payment processing and provider billing/settlement flows.

### Youverify
Identity verification, face matching and liveness.

### Vercel
Web application hosting and ordinary request/log processing.

## Collection versus sharing
Google Play treats some transfers to qualifying service providers differently from third-party “sharing”. For each Paystack, Youverify, Supabase and Vercel data flow, verify the current contract/terms before choosing the Play form's **shared** checkbox.

Do not mark a data type “not collected” merely because a processor rather than Rydah receives it: off-device transmission controlled by the app can still count as collection.

## Optional versus required
- GPS: optional.
- Push notifications: optional.
- Provider camera/identity verification: required only for users choosing the provider role where verification is needed for marketplace work.
- Customer account/profile details: required for authenticated customer functions.
- Job description/location: required when the user chooses to create a job.

## Data deletion
Rydah provides:
- an in-app deletion path; and
- a public web deletion resource.

Current deletion design removes the authentication account and anonymises/deletes account-linked personal records where configured. Limited transaction, dispute, fraud/safety or legally required records may be retained when necessary.

## App access
Some functionality is sign-in restricted. Play review must receive a reusable dedicated test account with English instructions. Never give reviewers a real customer/admin account.

## Final verification list
Before pressing **Save/Submit** in Data Safety:
1. Confirm production Youverify data returned to Rydah and retention terms.
2. Confirm production Paystack data flows and webhook payloads.
3. Confirm no analytics/advertising SDK was added.
4. Confirm whether crash/diagnostic logging meets a Play disclosure category.
5. Confirm Web Push categorisation under the then-current Play form.
6. Confirm actual retention periods for completed jobs, payments, disputes, safety reports and verification audit records.
7. Confirm Rydah Care conversation retention behaviour.
8. Confirm whether user-uploaded job photos/files exist in the submitted version.
9. Compare every final checkbox with the live privacy notice and submitted Android behaviour.
