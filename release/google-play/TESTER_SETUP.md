# Rydah Local — Google Play Closed Tester Setup

Prepared: 22 September 2026

## Requirement
For a new personal Google Play developer account, run a closed test with **at least 12 testers continuously opted in for at least 14 days** before applying for production access.

### Rydah operating target
Recruit **15–20 testers**, not exactly 12. This gives a buffer if someone fails to opt in correctly or leaves the test.

## Tester group
Create one Play Console closed-test track named:

**Rydah Local — Founding Testers**

Use a Google Group or Play Console email list. Tester emails must be Google-account addresses they can access on their Android devices.

A blank tracker is stored at:
`release/google-play/tester-tracker.csv`

Do not commit real tester emails to this public repository. Keep the completed tracker privately.

## Tester invitation message

Rydah Local is entering its private Google Play test.

Please:
1. Open the Google Play opt-in link I send you using the same Google account on your Android phone.
2. Tap **Become a tester / Join**.
3. Install Rydah Local from the test Play Store page.
4. Keep yourself opted in for the full **14 days** — please do not leave the test.
5. Use the app naturally and send me anything confusing, broken or slow.

Things to try: browsing services, city filters, sign-up/sign-in, posting a job, GPS when you choose to use it, back navigation, notifications and support.

Feedback: admin@rydahlocal.online

Thank you for helping us launch Rydah properly.

## Day-0 checklist
- Add at least 15 tester Google-account emails.
- Publish the closed-test release.
- Send the official Play opt-in link.
- Ask each tester to confirm they tapped Join and can see/install the app.
- Record each tester's opt-in date privately.
- Do not start counting a tester until they are actually opted in.

## 14-day test matrix

### All testers
- Install/update from Google Play.
- Launch app from icon.
- Check splash screen and home screen.
- Browse service categories.
- Change city/service filters.
- Check back button and refresh behaviour.
- Create a customer account or sign in.
- Test password reset.
- Open Privacy, Terms, Support and Delete Account pages.
- Report layout issues on their device model.

### Customer-flow testers
- Start a job request.
- Try manual service-area selection.
- Try optional GPS only after granting permission.
- Confirm contact details typed into restricted description fields are rejected.
- Review My Jobs states.
- Test notifications if prompted.
- Exercise Safety/Dispute screens using non-sensitive test content.

### Provider-flow testers
Use only designated provider testers.
- Create provider profile.
- Check service-area selection.
- Test onboarding UX.
- Test camera/liveness only with the tester's informed consent and genuine identity.
- Confirm the app does not let an unverified provider go online for jobs.
- Confirm retry/error messages are understandable.

### Payment testing
Until production Paystack is explicitly enabled, use only approved test-mode payment flows. Do not ask testers to make real payments merely to satisfy the Play closed-test requirement.

## Feedback questions
Ask testers:
- What did you think Rydah Local does within the first 10 seconds?
- Could you find the service you wanted?
- Was the city/location flow clear?
- Did any button feel dead or misleading?
- Did Android back navigation behave as expected?
- Did sign-in/password reset work?
- Were permission requests understandable?
- What would stop you trusting a provider on the app?
- What would stop you using Rydah again?

## Production-access notes
When the 14-day requirement is complete, Play Console asks about:
- how testers were recruited,
- tester engagement,
- feedback received,
- what changed because of testing,
- why the app is ready for production.

Keep a short private record of real feedback and fixes throughout the test. Do not invent tester activity.
