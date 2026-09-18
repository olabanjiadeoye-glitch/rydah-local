# Rydah Local Android signing setup

## Canonical Android identity
- Package / application ID: `online.rydahlocal.app`
- Initial versionName: `0.1.0`
- Initial versionCode: `1`
- Target SDK: API 36

## Upload key
The first Play upload bundle has been signed with a dedicated Rydah upload key.

Upload certificate SHA-256 fingerprint:

`3E:9C:AB:B2:EF:2F:74:13:6F:B7:13:06:97:33:62:A0:33:E0:A4:31:8C:84:3A:AC:05:91:77:73:EC:A5:39:9E`

The private keystore and password are intentionally **not stored in this repository**. They must be kept in the owner's secure offline backup and, for automated future releases, stored only in an approved secrets manager / GitHub Actions secrets.

## Google Play App Signing
Enable Google Play App Signing when creating the Play Console app.

Important: the certificate Google Play uses to sign the APKs delivered to users may differ from the upload certificate above. After the first bundle is uploaded:

1. Open Play Console -> App integrity.
2. Copy the **App signing key certificate SHA-256 fingerprint**.
3. Configure production environment variable `ANDROID_APP_SHA256_FINGERPRINT` with that fingerprint.
4. Redeploy `rydahlocal.online`.
5. Confirm `https://rydahlocal.online/.well-known/assetlinks.json` returns the production package `online.rydahlocal.app` and the Play app-signing fingerprint.

Do not use the upload-key fingerprint for production Digital Asset Links unless Play Console explicitly shows that the app-signing certificate is the same certificate.

## CI
The Android CI validates:
- Bubblewrap project generation
- successful AAB build
- API 36 target
- 512x512 Play icon generation
- 1024x500 feature graphic generation

The CI output is intentionally unsigned. Signing is kept separate from public repository code.
