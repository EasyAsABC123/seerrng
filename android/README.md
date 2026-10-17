# SeerrNG for Android

The Android app opens your existing SeerrNG server in an app-managed WebView. Add a server URL when the app launches; the server list supports multiple saved addresses. HTTPS is preferred. The app asks for explicit confirmation before connecting over HTTP because HTTP does not protect passwords or session cookies on the network.

## Release build

Build with Java 17, Android SDK platform 36, and Build Tools 36.0.0:

```sh
bash scripts/build-android-release.sh vX.Y.Z android/dist
```

The script verifies the APK and App Bundle signatures and writes `seerrng-vX.Y.Z-android.apk` / `.aab` in `ads` mode, or `seerrng-vX.Y.Z-android-capped.apk` / `.aab` in `capped` mode. Each artifact gets a SHA-256 sidecar. The APK is for direct installation; the AAB is signed with the same upload key for Google Play App Signing.

Configure these GitHub Actions repository secrets for signed builds:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded PKCS#12 release keystore
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: `seerrng-android-release`
- `ANDROID_KEY_PASSWORD`: same value as `ANDROID_KEYSTORE_PASSWORD` for PKCS#12

## Monetization modes

The default release mode is `ads`: a non-personalized adaptive banner appears below the server WebView, and Google UMP handles consent and privacy choices. Debug builds use Google's test app and banner IDs; they never request live ads.

The [SeerrNG Mobile privacy policy](https://snapetech-org.github.io/seerrng-android-privacy/) is public, hosted over HTTPS, and linked from the app's first-launch setup and server list. Use this same URL in Play Console and AdMob.

See [mobile release readiness](../docs/mobile-release-readiness.md) for the iOS client, store checklists, signing, GitHub packaging, and remaining release gates.

To enable ad-supported releases and the Google Play lifetime unlock, configure these repository variables:

- `ANDROID_MONETIZATION_MODE`: `ads` or `capped` (defaults to `ads`); candidate and tagged release workflows package the selected mode
- `ENABLE_PLAY_BILLING`: `true`
- `ADMOB_APP_ID`: the app ID from AdMob
- `ADMOB_BANNER_AD_UNIT_ID`: the banner ad unit ID

Create a one-time Google Play product with ID `lifetime_unlock`; Play Console supplies the localized price shown in the app. Create and publish an AdMob UMP consent message before setting the ad variables.

Google Play Billing requires the package and product to be set up in Play Console. Google documents that billing is blocked for apps not signed and uploaded to Play; registered license testers can sideload for testing. A direct APK download therefore does not provide a separate checkout path.

The client checks Play-owned purchases at launch and resume, acknowledges completed purchases, and caches the lifetime unlock for offline use. Purchase tokens are not currently verified by a backend. Google recommends backend verification and voided-purchase handling; see [MONETIZATION.md](MONETIZATION.md) before public rollout.

An alternative no-ads build caps use locally. The default evaluation allowance is 20 successful server sessions per install. Build it with:

```sh
ANDROID_MONETIZATION_MODE=capped FREE_SESSION_LIMIT=20 \
  bash scripts/build-android-release.sh vX.Y.Z android/dist
```

For debug testing, set `-PandroidMonetizationMode=capped -PfreeSessionLimit=2` on the Gradle command. The default is `ads`. The cap does not count requests or actions inside SeerrNG's web app, sync between devices, or resist clearing app data; its exact behavior and the store and hosted alternatives are documented in [MONETIZATION.md](MONETIZATION.md).

Keep the private keystore and passwords in encrypted recovery storage. Never commit them to this repository. Every update to an installed APK must use the same signing certificate and a higher Android version code.

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
