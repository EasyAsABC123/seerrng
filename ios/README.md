# SeerrNG for iOS

The iOS client is a SwiftUI app for saving multiple SeerrNG server addresses and opening a selected server in a persistent `WKWebView`. Each saved server gets its own WebKit data store, so sign-in cookies stay separate; deleting a saved server deletes that profile's WebKit data. HTTPS is the default. The app requires an explicit confirmation before saving an HTTP address.

The client includes a local preview counter (20 successful server sessions per installation) and a StoreKit 2 non-consumable lifetime unlock using product ID `lifetime_unlock`. The counter is on-device and can be reset by deleting app data or reinstalling. The StoreKit product has not been created in App Store Connect; the store supplies the displayed price after setup. There are no iOS ads or analytics SDKs.

## Build and test

Use Xcode 26 or newer on macOS:

```sh
bash scripts/build-ios-release.sh v3.62.0 dist-ios
```

The script runs the unit and UI test targets, then writes a zipped iOS Simulator `.app` and SHA-256 sidecar. That simulator package is useful for development and is not installable on a physical iPhone or iPad.

The `iOS Client` GitHub Actions workflow runs the same tests on a macOS 26 runner. Release tags also produce a Simulator package on GitHub Releases. The workflow can additionally produce signed IPAs when the Apple signing secrets below are configured.

## Device and store signing

Apple does not allow a self-signed iOS app to install on ordinary devices. A device-installable Ad Hoc IPA needs an Apple Developer Program distribution certificate, an Ad Hoc provisioning profile, and the device UDIDs registered in that profile. An App Store Connect IPA needs a distribution certificate and an App Store provisioning profile; it must be uploaded through Apple tooling before TestFlight or App Store distribution.

Configure repository Actions variables and secrets only after the Apple Developer team and profiles are ready:

| Purpose | GitHub Actions value |
| --- | --- |
| Shared signing certificate | Secret `IOS_DISTRIBUTION_CERTIFICATE_BASE64` (base64-encoded `.p12`) |
| Certificate password | Secret `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` |
| Apple team | Secret `IOS_TEAM_ID` |
| App Store profile | Secret `IOS_APPSTORE_PROVISIONING_PROFILE_BASE64`; variable `IOS_APPSTORE_SIGNING_ENABLED=true` |
| Ad Hoc profile with registered devices | Secret `IOS_ADHOC_PROVISIONING_PROFILE_BASE64`; variable `IOS_ADHOC_SIGNING_ENABLED=true` |

The release workflow checks the profile's team and bundle identifier (`org.snapetech.seerrng.ios`), installs signing material into a temporary keychain, verifies the exported app signature, writes a checksum, and removes the temporary keychain and profile after the build. Never commit signing files or passwords.

## Store review work still required

- Create the app record and `lifetime_unlock` non-consumable product in App Store Connect; set regional pricing there.
- Complete StoreKit testing with a StoreKit Configuration and Apple sandbox tester, including purchase, pending, cancelled, restored, and revoked states.
- Provide App Review with a stable, working SeerrNG demo server and credentials or a full demo mode. Do not submit with placeholder URLs.
- Review content served by user-configured servers. The client does not currently filter adult media routes; this needs a store-specific content decision before submission.
- The app has native server management and purchase flows, but most server interaction is still rendered by the SeerrNG website. App Review may consider a configurable web wrapper too close to a repackaged website. Review Guideline 4.2 before paying for enrollment or submitting.

See [the mobile release checklist](../docs/mobile-release-readiness.md) for the store, privacy, monetization, signing, and review plan.
