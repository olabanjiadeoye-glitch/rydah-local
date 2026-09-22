# Rydah Local — Play Console Launch Checklist

## Already prepared
- [x] Canonical package ID: `online.rydahlocal.app`
- [x] Android TWA build definition
- [x] Android target SDK 36
- [x] CI-built unsigned AAB
- [x] Dedicated upload-certificate fingerprint documented
- [x] 512 × 512 Play icon generation
- [x] 1024 × 500 feature graphic generation
- [x] Live privacy policy
- [x] Live account-deletion resource
- [x] Store listing copy
- [x] Data Safety working draft
- [x] Closed-test plan
- [x] Automated genuine phone screenshot capture

## Waiting on Google account verification
- [ ] Google identity/address verification approved
- [ ] Contact phone number verified
- [ ] Create/select the Rydah Local app in Play Console using `online.rydahlocal.app`

## Before first closed-test upload
- [ ] Confirm the permanent upload keystore is available in the owner's secure backup
- [ ] Produce/sign the first AAB with the documented Rydah upload key
- [ ] Enable Play App Signing
- [ ] Copy the **Play app-signing** SHA-256 fingerprint from App integrity
- [ ] Set production `ANDROID_APP_SHA256_FINGERPRINT`
- [ ] Verify `https://rydahlocal.online/.well-known/assetlinks.json`
- [ ] Confirm TWA launches without browser chrome

## Play Console App content
- [ ] Privacy policy URL
- [ ] Ads declaration: No
- [ ] App access: restricted / reviewer credentials supplied
- [ ] Target audience and content
- [ ] Content rating questionnaire
- [ ] Data Safety
- [ ] Account deletion web URL
- [ ] Any permission declarations Play Console requests from the uploaded bundle

## Closed test
- [ ] Create **Rydah Local — Founding Testers**
- [ ] Add 15–20 testers
- [ ] Publish closed-test release
- [ ] Send opt-in link
- [ ] Confirm at least 12 remain continuously opted in for 14 days
- [ ] Record genuine tester feedback and fixes

## Before production application
- [ ] Production Paystack configuration checked
- [ ] Production Youverify configuration checked
- [ ] Real-device camera/liveness test passed
- [ ] Real-device GPS test passed
- [ ] Password reset tested from Android app
- [ ] Notifications tested
- [ ] Android back navigation tested
- [ ] Customer → quote → arrival → job → payment end-to-end flow tested
- [ ] No seeded/demo provider is presented as a genuinely available verified provider
- [ ] Final Data Safety answers rechecked against actual production behaviour
