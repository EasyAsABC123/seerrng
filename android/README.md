# SeerrNG for Android

The Android app opens a SeerrNG server that the user enters. It supports multiple saved addresses and keeps each server's WebView sign-in separate where the installed Android System WebView supports profiles. HTTPS is recommended. The app asks before connecting over HTTP because HTTP does not protect passwords or session cookies on the network.

## Free preview and lifetime unlock

The Google Play app is free to download. Once Play Billing is configured, it includes 20 successful server sessions per installation; a one-time Google Play purchase unlocks unlimited sessions for that Play account. There are no ads or advertising SDKs. The recommended US price is **$2.99 once**. Play Console is the source of truth for the configured price and localizes it for each storefront.

The app reads the price from Google Play and does not hardcode currency. Create a non-consumable in-app product with ID `lifetime_unlock`, configure its base and regional prices, test it with license testers, then set the GitHub Actions repository variable `ENABLE_PLAY_BILLING=true`. Until that is done, release builds are unlimited free evaluation builds and hide the purchase controls, so users are not capped without a working purchase path. The app also recognizes the legacy `no_ads_lifetime` purchase ID so existing owners can restore a previous entitlement.

The preview count stays on the device. One session is counted after the first successful main page load; switching saved servers during the same app session does not count again. Clearing app data or reinstalling resets the count. GitHub APKs are for direct evaluation; checkout and restore depend on Google Play and should be tested from a Play test track.

See [MONETIZATION.md](MONETIZATION.md) for the price research, exact cap behavior, billing configuration, and trade-offs.

## Release build

Build with Java 17, Android SDK platform 36, and Build Tools 36.0.0:

```sh
bash scripts/build-android-release.sh vX.Y.Z android/dist
```

The script verifies APK and App Bundle signatures and writes:

- `seerrng-vX.Y.Z-android.apk`
- `seerrng-vX.Y.Z-android.sha256`
- `seerrng-vX.Y.Z-android.aab`
- `seerrng-vX.Y.Z-android-aab.sha256`

The APK is for direct installation. Upload the signed AAB to Play Console and enable Play App Signing for store distribution.

Configure these GitHub Actions repository secrets for signed builds:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded PKCS#12 release keystore
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: `seerrng-android-release`
- `ANDROID_KEY_PASSWORD`: same value as `ANDROID_KEYSTORE_PASSWORD` for PKCS#12

Set the `ENABLE_PLAY_BILLING` repository variable only after the Play app and product are configured. The default is `false`, so an unconfigured release cannot offer a broken purchase flow.

The public [SeerrNG Mobile privacy policy](https://snapetech-org.github.io/seerrng-android-privacy/) is linked from the app and should also be used in Play Console.

## Testing

Run unit tests, emulator UI tests, and a debug APK build:

```sh
./android/gradlew --no-daemon -p android \
  -PfreeSessionLimit=2 \
  :app:testDebugUnitTest \
  :app:connectedDebugAndroidTest \
  :app:assembleDebug
```

The Android Actions workflow also builds a signed release candidate, verifies its APK and AAB, installs the APK on the API 36 emulator, and launches the app.

## Signing identity

Android APKs use a developer signing certificate rather than a certificate issued by a public web CA. Android accepts an update when its signer matches the installed app's signer. This app uses a stable RSA 4096-bit release key; its certificate SHA-256 fingerprint is:

```text
4C:4E:5D:6D:98:3A:65:BA:A3:1E:4F:BE:B8:9A:EB:E4:00:31:3B:D4:68:B6:57:5C:AD:15:74:58:37:0C:FB:5C
```

Verify a downloaded APK and inspect its signing certificate with Android Build Tools:

```sh
apksigner verify --verbose --print-certs seerrng-vX.Y.Z-android.apk
sha256sum --check seerrng-vX.Y.Z-android.sha256
sha256sum --check seerrng-vX.Y.Z-android-aab.sha256
```

Keep the private keystore and passwords in encrypted recovery storage. Never commit them. Every update to an installed APK must use the same signing certificate and a higher Android version code.

See [mobile release readiness](../docs/mobile-release-readiness.md) for iOS signing, store checklists, GitHub packaging, and remaining release gates.
