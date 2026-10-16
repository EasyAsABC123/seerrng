# SeerrNG for Android

The Android app opens your existing SeerrNG server in an app-managed WebView. Add a server URL when the app launches; the server list supports multiple saved addresses. HTTPS is preferred. The app asks for explicit confirmation before connecting over HTTP because HTTP does not protect passwords or session cookies on the network.

## Release build

Build with Java 17, Android SDK platform 36, and Build Tools 36.0.0:

```sh
bash scripts/build-android-release.sh vX.Y.Z android/dist
```

The script verifies the APK signature and writes `seerrng-vX.Y.Z-android.apk` and its `.sha256` checksum. The release workflow uses the same script and attaches both files to Android-enabled releases.

Configure these GitHub Actions repository secrets for signed builds:

- `ANDROID_KEYSTORE_BASE64`: base64-encoded PKCS#12 release keystore
- `ANDROID_KEYSTORE_PASSWORD`: keystore password
- `ANDROID_KEY_ALIAS`: `seerrng-android-release`
- `ANDROID_KEY_PASSWORD`: same value as `ANDROID_KEYSTORE_PASSWORD` for PKCS#12

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
```
