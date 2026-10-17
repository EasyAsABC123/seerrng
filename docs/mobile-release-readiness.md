# SeerrNG mobile release readiness

This guide records the Android and iOS package formats, verification steps, GitHub release path, and remaining store work. The mobile source is merged to `main`. The current downloadable files and their checksums are linked from the [README](https://github.com/snapetech-org/seerrng/blob/main/README.md#android-apk); confirm account-specific items in Play Console or App Store Connect before submission.

## What is built

| Platform | Package ID | Native app work | Current release package |
| --- | --- | --- | --- |
| Android | `org.snapetech.seerrng` | Server picker, add/edit/remove multiple URLs, Android WebView profiles, downloads, privacy link, 20-session local preview when Play Billing is enabled, one-time unlock; no ads | Stable-key signed APK for direct installation and signed AAB for Play App Signing; both get SHA-256 sidecars |
| iOS | `org.snapetech.seerrng.ios` | SwiftUI server manager, per-server persistent WebKit profiles, browser navigation, HTTP warning, local capped preview, StoreKit 2 lifetime unlock | iOS Simulator `.app` ZIP and checksum; optional App Store Connect and Ad Hoc IPAs when Apple signing is configured |

Both clients connect directly to a server that the user enters. There is no central SeerrNG account or license service. HTTPS is recommended. The iOS build uses an explicit WebKit-only App Transport Security exception because the server hostname is user-configured and may be a private HTTP address; the UI warns before saving HTTP. Apple requires justification for network exceptions, so test and review this reason as part of submission.

## Build and test paths

### Android

```sh
./android/gradlew --no-daemon -p android \
  :app:testDebugUnitTest \
  :app:connectedDebugAndroidTest \
  :app:assembleDebug

bash scripts/build-android-release.sh vX.Y.Z dist-release
```

The Android release script needs the configured stable signing secrets and Android SDK Build Tools 36.0.0. It builds and verifies both:

- `seerrng-vX.Y.Z-android.apk` and `seerrng-vX.Y.Z-android.aab`, each with a SHA-256 sidecar. Every Android build uses the 20-successful-session preview; there is no advertising build variant.
- APKs are for direct install and updates signed with the same developer-controlled key. The AAB is signed with that key as the Play upload key. Google Play App Signing must be enabled in Play Console before the AAB can be distributed from Play.

The APK's signer fingerprint and update-key handling are documented in [android/README.md](https://github.com/snapetech-org/seerrng/blob/main/android/README.md). The keystore is not in the repository. GitHub Actions already has the Android keystore secrets configured; no signing secret values are printed or stored in this guide.

### iOS

```sh
bash scripts/build-ios-release.sh vX.Y.Z dist-release
```

This requires macOS and Xcode 26 or newer. It runs Swift unit tests and iOS Simulator UI tests, builds a Release Simulator app, and emits `seerrng-vX.Y.Z-ios-simulator.zip` with a checksum. The zip is for the Simulator; it is not an iPhone/iPad IPA.

The GitHub release workflow always attaches that Simulator package. When Apple signing material is configured, the workflow also runs `scripts/build-ios-signed-ipa.sh` to create:

- `seerrng-vX.Y.Z-ios-appstore.ipa` for upload to App Store Connect or TestFlight. This is not a direct-install GitHub IPA.
- `seerrng-vX.Y.Z-ios-adhoc.ipa` for devices listed in its Ad Hoc provisioning profile.

Both signed variants include SHA-256 sidecars. Configure the required secrets and `IOS_APPSTORE_SIGNING_ENABLED` / `IOS_ADHOC_SIGNING_ENABLED` Actions variables only after the Apple team, certificate, and matching provisioning profiles exist. The signing script uses a temporary macOS keychain and removes its temporary signing files after the build.

An iOS app cannot use a self-signed certificate for ordinary installation. Ad Hoc distribution requires an Apple Developer Program membership, a distribution certificate, and registered device IDs; an App Store profile is needed for TestFlight/App Store distribution. See [ios/README.md](https://github.com/snapetech-org/seerrng/blob/main/ios/README.md).

### Automated checks

- `.github/workflows/android.yml` runs Android unit and emulator UI tests with a two-session test limit, then installs and launches the signed APK on the API 36 emulator before uploading the APK/AAB candidate.
- `.github/workflows/ios.yml` runs iOS unit and UI tests on GitHub's macOS 26 runner and retains the Simulator package plus test results.
- Main-branch candidate names use the application version from `package.json` plus the workflow run number, so the package version follows each SeerrNG release-preparation commit. Tagged releases use the exact release tag.
- Tagged releases validate checksums and attach the Android APK/AAB and iOS Simulator package. Signed iOS IPAs are conditional on the signing variables and secrets.
- The standard release workflow only builds tags reachable from `main`. The current mobile test packages are also attached to a dedicated prerelease, so users can download them without waiting for a server release.

### Current GitHub mobile prerelease

The current tested packages are attached to the [SeerrNG mobile prerelease](https://github.com/snapetech-org/seerrng/releases/tag/mobile-v3.63.0-ci.35), built from `main` commit `3ed9200e4421e6526c8449d895749913c031ddf8`. Its release assets are permanent downloads with SHA-256 sidecars; the corresponding Actions artifacts are temporary.

| Package | Version | SHA-256 | Details |
| --- | --- | --- | --- |
| Android APK | `3.63.0-ci.35` | `98e68be60e450bbca27e45ef875652432d884c0e8a4dd9b6884a9ea8bc338cbd` | No-ad direct-install package, signed with the stable RSA-4096 project key; APK Signature Scheme v2 verified, installed, and launched on the API 36 emulator. |
| Android App Bundle | `3.63.0-ci.35` | `bfbbf0c3df3621d57648bc13b3c6c28cff849d2a3774868da7b64744d7c149d7` | Signed with the stable upload key for a future Play upload; Play App Signing is pending app-record setup. |
| iOS Simulator ZIP | `3.63.0-ci.20` | `3a712bf2efba4590da7df206635661e3d8a743e1eae6c93f6af5948d5f92088d` | Bundle ID `org.snapetech.seerrng.ios`; Simulator-only, not an iPhone/iPad IPA. iOS source was unchanged after its passing run. |

The [Android Actions run](https://github.com/snapetech-org/seerrng/actions/runs/38997834311) passed unit and API 36 emulator tests, verified the release signatures, then installed and launched the signed APK. The [iOS Actions run](https://github.com/snapetech-org/seerrng/actions/runs/38997049997) passed the unit and UI test suites and built the Simulator app. Each release package has a SHA-256 sidecar.

This is a testing prerelease, not a store-approved release. Neither client contains advertising or analytics SDKs. Play Billing is disabled in the GitHub Android package, so the package is unlimited and does not demonstrate the 20-session cap or a live purchase. The iOS package is not device-installable until Apple distribution signing assets are configured.

## Monetization and trial choice

The first version can ship without hosted entitlement infrastructure. Keep purchases owned by the platform store and keep the usage preview local. A central quota would require a new account/service or API changes to each self-hosted server.

| Option | Android | iOS | Hosted service |
| --- | --- | --- | --- |
| Free preview + lifetime unlock | 20 successful sessions per installation when Play Billing is enabled, followed by Google Play Billing product ID `lifetime_unlock`. Recommended US price: **$2.99 once**, with local store pricing. Before product setup, release builds are unlimited free evaluation builds. | Implemented as 20 successful server sessions per installation, with StoreKit 2 product ID `lifetime_unlock`; use the closest App Store tier to US$2.99 when that product is configured. | No; local caps can reset on reinstall or data clear |
| Store subscription with free trial | Play supports trial offers that renew into a subscription. | StoreKit supports introductory subscription offers. | No for store-account entitlements; a backend is recommended for authoritative cross-device purchase state |
| Account-wide or tamper-resistant usage limit | Not implemented | Not implemented | Yes |

The recommended US price is $2.99 once. The research and rationale are documented in [android/MONETIZATION.md](https://github.com/snapetech-org/seerrng/blob/main/android/MONETIZATION.md). Play Billing and StoreKit provide the final localized price; neither app hardcodes currency. Configure independent one-time products in each store.

Keep the cap behavior transparent: 20 successful server sessions per installation, not 20 requests. A session is counted when the first page load finishes. A session remains open while switching saved servers; closing it and starting another may use another preview session. Local counters are an evaluation gate and can be reset by deleting app data or reinstalling. There is no SeerrNG-hosted usage counter.

Google Play and Apple's stores sell/check out a one-time digital unlock through their own billing APIs. An Android Play Billing purchase does not unlock iOS; each store product is separate even if the product ID matches. Do not enable purchase UI on a release until the store product is available and purchase/restore behavior has been tested in the platform's test environment. Store trial offers are subscription promotions, not arbitrary action counters.

## Store account and submission checklist

### Google Play

- [x] Create the Play Console developer account and pay the one-time US$25 registration fee. Identity documents have been submitted; Play Console currently says Google is reviewing them.
- [ ] After Google approves the identity documents, verify a real Android device through the Play Console mobile app and complete contact-phone verification. Both currently show as required in Console.
- [ ] For this personal account, complete the required closed test before applying for production access: at least 12 opted-in testers for 14 continuous days.
- [ ] After the account setup tasks clear, create the app record for `org.snapetech.seerrng`; upload the signed AAB and enroll in Play App Signing. Keep the direct-install APK signed by the same stable developer key.
- [ ] Complete the content rating, target audience, Data safety, no-ads declaration, and app access declarations accurately.
- [ ] Create and publish a one-time product `lifetime_unlock`, set the recommended US base price to $2.99, review local prices, enable `ENABLE_PLAY_BILLING=true`, add license testers, and test purchase, restore, pending, cancelled, and refund/revocation behavior through a Play test track.
- [ ] Provide Play reviewers with a stable working server or a demo flow and test credentials.
- [ ] Before shipping adult-media capable SeerrNG servers, establish a store-compatible content policy and enforcement path. See the content gate below.

**Console status checked 2026-10-17:** Google is still reviewing the uploaded identity documents. The Play Console home page marks real Android device verification and contact-phone verification as required, and the app-creation action is disabled until those account checks are complete. No Play app record, product, or test track has been created yet. Device verification must be completed in the Play Console mobile app on a non-rooted physical Android 10+ phone; an emulator, iPhone, or this remote desktop cannot substitute for it. The Android phone can use Wi-Fi without a SIM; Google says its phone number is not used or collected for this device check. After the identity and device checks pass, contact-phone verification can use any number that receives Google's SMS or voice code, including the owner's iPhone number.

Google currently requires new apps and updates to target Android 16 / API 36 from 31 August 2026; this Android project already targets API 36. Check the requirement again before each submission.

### Apple App Store

- [ ] Enroll in the Apple Developer Program (currently US$99 per year), register the bundle ID `org.snapetech.seerrng.ios`, and create the App Store Connect app record.
- [ ] Create StoreKit product `lifetime_unlock`, choose price tiers/regions, add sandbox testers, and test purchase, restore, pending, cancelled, and revoked states.
- [ ] Create an Apple Distribution certificate and App Store provisioning profile. Configure GitHub secrets and enable `IOS_APPSTORE_SIGNING_ENABLED=true` to build the App Store Connect IPA.
- [ ] For a direct GitHub device test build, register the target iPhone/iPad UDIDs, make an Ad Hoc profile, configure its GitHub secret, and set `IOS_ADHOC_SIGNING_ENABLED=true`. That IPA only installs on the devices in the profile.
- [ ] Create a stable, accessible SeerrNG demo server and reviewer account or add a full demo mode. Include detailed review notes and live service access.
- [ ] Complete the App Privacy details, age rating, support URL, screenshots, subtitle, description, and purchase metadata. The public mobile privacy policy now covers both apps; review its disclosures against the final store build before submission.
- [ ] Review network security exceptions, user-configured HTTP connections, StoreKit requirements, adult-content access, and whether the app provides enough native utility for App Review.

## Store review and content risks

1. **The iOS app is not a plain store-ready approval.** It has native server management, isolated WebKit profiles, a native trial screen, and StoreKit, but it still renders the SeerrNG web interface for most work. Apple's Guideline 4.2 requires useful, app-like features beyond a repackaged website. The reviewer also needs a working backend and login or a complete demo mode. Approval is uncertain until the app review path and product experience are validated.
2. **Content is controlled by the connected server.** This SeerrNG repository includes adult-media functionality. The mobile clients do not currently block it. Apple prohibits overtly sexual/pornographic material, with narrow treatment for incidental mature web content hidden by default; Google Play also restricts sexual content and only allows limited catalog/UGC cases. A store release needs an enforceable, reviewed store-mode content policy; a disclaimer alone is not enough.
3. **HTTP requires an explicit choice.** The user-configured server may be LAN-only, so HTTP is supported after a warning. HTTP can expose credentials and session cookies. The iOS app's broad WebKit-only ATS exception needs a clear review note and may draw scrutiny.
4. **The preview is local.** It can be reset and is not suitable for fraud-resistant licensing. StoreKit/Play Billing own the lifetime unlock; the current Android entitlement is not verified by a publisher backend. If the product needs account-wide restoration, refund enforcement, or server-side authorization, estimate a backend before selling the unlock.

## Store listing draft

The first pass of App Store and Play listing text is in [mobile-store-listing-draft.md](mobile-store-listing-draft.md). Screenshots, age/content ratings, data disclosures, reviewer credentials, and launch regions remain unfinished because they depend on a working demo and store onboarding.

## Privacy and data handling

- Server names and normalized URLs are stored on the device.
- Each iOS server has its own persistent WebKit profile. Removing a server removes that profile. Android uses an app-managed WebView profile per server.
- Web sign-in and normal SeerrNG requests go directly to the user's selected server, which controls its logs and data retention.
- The iOS preview counter and the Android counter when Play Billing is enabled are local. StoreKit/Play Billing process purchases with Apple/Google; the publisher does not receive server credentials, cookies, or URLs.
- Neither mobile client includes advertising or analytics SDKs. The Android app uses Google Play Billing only when the store product is configured; iOS uses StoreKit.
- The published policy URL is `https://snapetech-org.github.io/seerrng-android-privacy/`; privacy and support requests go to `support@snape.tech`. It covers both clients, store purchases, per-server browser profiles, and profile deletion. Recheck it against the final integrations before submitting either app.

## Official references

- [Google Play Console setup and fee](https://support.google.com/googleplay/android-developer/answer/6112435)
- [Google Play developer identity and phone verification](https://support.google.com/android-developer-console/answer/16641416)
- [Google Play device verification requirements](https://support.google.com/googleplay/android-developer/answer/14316361)
- [Google Play personal account closed-test requirement](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google Play one-time product setup](https://support.google.com/googleplay/android-developer/answer/16430488)
- [Create and set up an app in Play Console](https://support.google.com/googleplay/android-developer/answer/9859152)
- [Google Play target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Android app signing and Play App Signing](https://developer.android.com/studio/publish/app-signing)
- [Apple Developer Program membership](https://developer.apple.com/programs/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Ad Hoc distribution devices](https://developer.apple.com/help/account/devices/devices-overview)
- [Apple App Transport Security exceptions](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)
- [WebKit persistent profiles and data removal](https://developer.apple.com/documentation/webkit/wkwebsitedatastore)
- [Google Play inappropriate-content policy](https://support.google.com/googleplay/android-developer/answer/9878810)
