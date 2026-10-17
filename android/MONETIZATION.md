# Android monetization options

This document compares the current ad-supported prototype with a capped-use option, store-managed subscription trials, and a hosted account model. The client is a native Android shell that opens each user's own SeerrNG server in a WebView; it does not run the SeerrNG backend. That boundary determines what a local usage cap can count.

## Current implementation

The app can be built in either of two modes:

| Mode | Free access | Lifetime purchase |
| --- | --- | --- |
| `ads` (default) | No session cap; a non-personalized adaptive banner appears below the server WebView when production ad IDs and UMP configuration are supplied. | Removes in-app banner ads. |
| `capped` | No ads; 20 successful server sessions per app installation by default. | Removes the session cap. |

Both modes use the same prospective Google Play non-consumable product ID, `lifetime_unlock`. The requested $10 amount is a pricing candidate; its currency is not selected, and no product, price, AdMob app ID, banner ID, or published consent message has been created in Play Console or AdMob yet. The store will localize and display the configured price before purchase.

Choose the mode at build time:

```sh
# Ad-supported build (the default)
bash scripts/build-android-release.sh vX.Y.Z android/dist

# No-ad, capped-use build
ANDROID_MONETIZATION_MODE=capped FREE_SESSION_LIMIT=20 \
  bash scripts/build-android-release.sh vX.Y.Z android/dist

# Fast debug/CI build with a small cap
./android/gradlew -p android \
  -PandroidMonetizationMode=capped -PfreeSessionLimit=2 \
  :app:testDebugUnitTest :app:assembleDebug
```

The release script emits `seerrng-vX.Y.Z-android.apk` for `ads` and `seerrng-vX.Y.Z-android-capped.apk` for `capped`; each gets its own SHA-256 sidecar. The APK signing identity is unchanged between modes.

A capped release is for QA only until Play Billing is enabled and the lifetime product is available. Without billing, the preview still expires but the purchase controls are hidden, so a user cannot continue after the cap.

### How the capped preview behaves

- The default limit is 20; `FREE_SESSION_LIMIT` or `-PfreeSessionLimit` can change it for a build. The value must be a positive integer.
- A session is counted after the first server page successfully finishes loading in the app's main screen. A bad URL, an offline server, an HTTP error page, or a failed page load does not consume a session.
- Only the first successful server connection in that open app screen counts. Going back to the server list, switching among saved servers, backgrounding, and resuming do not charge additional sessions for that screen.
- The counter is stored in private app preferences on the device. It applies across all servers saved in that installation. It does not count clicks, searches, requests, or other actions inside the SeerrNG web app.
- An already-open session remains usable after its final free session is counted. After that app screen is closed and the app is opened again, connecting is blocked until the lifetime unlock is found or restored.
- Clearing app data or reinstalling resets the local counter. The prototype is a low-friction evaluation gate, not a tamper-resistant license system. A modified client or restored local preference can bypass it.
- The cap does not alter the SeerrNG server's own authentication, roles, quotas, or request rules. It only controls whether this Android client starts another WebView session.

The privacy policy already describes data stored on-device. This counter is local only; it does not send server URLs, use counts, account identifiers, or analytics to SeerrNG or a SeerrNG-operated service.

## What app stores provide

Google Play and Apple's App Store provide product catalogs, checkout, purchase records, and purchase restoration. They do not provide an arbitrary “allow N free server actions” counter for an app to configure.

| Mechanism | Store support | Hosted service required? | Main trade-off |
| --- | --- | --- | --- |
| One-time lifetime unlock | Google Play non-consumable one-time product; Apple non-consumable IAP. | No for a device-only entitlement. A backend is recommended for authoritative verification, refunds, or cross-device account linking. | One payment grants a permanent benefit. Fits the proposed $10 lifetime unlock. |
| Free trial that converts to subscription | Google Play subscription offer; Apple auto-renewable subscription introductory offer, including a free trial. | No for a store-account entitlement that is checked on the device. A backend is recommended for secure verification and subscription notifications. | The trial converts to a recurring paid subscription unless cancelled. Requires ongoing subscription value and clear renewal terms. |
| Time-limited access without subscription | App-managed clock/expiry, or a store non-renewing subscription where appropriate. | No for per-install timing; yes for reliable cross-device timing. | Local clocks and reinstall can reset a client-only timer. Apple's non-renewing subscription leaves duration tracking and restoration to the app. |
| Free-use or action quota | The app implements the counter. Consumable store products can sell credit packs, but the app still decrements credits. | No for a per-install counter; yes for account-wide or tamper-resistant limits. | Local counters are easy to reset. A secure account-wide counter needs a durable identity and a backend. |
| Hosted free quota | A SeerrNG-operated service or a change to each connected server checks a user's entitlement and remaining quota. | Yes. | Stronger cross-device enforcement, with account, privacy, availability, security, and operating-cost responsibilities. |

Google describes consumable products as items users can buy again after use, and non-consumables as one-time permanent benefits such as ad removal. Its subscription offers support free trials; after the trial, the subscription renews at the regular price unless cancelled. See [Google Play one-time products](https://developer.android.com/google/play/billing/one-time-products), [Google Play subscriptions](https://developer.android.com/google/play/billing/subscriptions), and [Google Play Billing integration testing](https://developer.android.com/google/play/billing/test).

Apple supports consumable, non-consumable, auto-renewable subscription, and non-renewing subscription IAP types. Introductory subscription offers can include a free trial; the subscription begins immediately and renews at the regular price after the trial. Apple says auto-renewable subscriptions must provide ongoing value, last at least seven days, and work across the user's devices. See [App Store Connect IAP types](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types), [StoreKit introductory offers](https://developer.apple.com/documentation/storekit/implementing-introductory-offers-in-your-app), and [App Review Guidelines, payments and subscriptions](https://developer.apple.com/app-store/review/guidelines/).

If a native iOS SeerrNG client is ever built, it will need a separate StoreKit integration and its own product identifiers. Current Apple payment rules require careful review before offering an external payment route for an in-app digital unlock; an Android product or checkout cannot simply be reused in an iOS app.

## Does a trial need our own server?

**No, for a per-install cap or a store-managed subscription trial.** The capped prototype uses Android private storage and can enforce its rule offline. A Play subscription trial can be configured in Play Console and checked through Play Billing. Apple introductory offers can be configured in App Store Connect and checked through StoreKit. In both cases, the store handles trial eligibility and billing; the app decides what access to grant based on the store entitlement.

**Yes, for reliable account-wide usage limits or authoritative purchase verification.** This client connects to many unrelated, user-operated SeerrNG servers and has no single SeerrNG account that identifies the user across them. A central counter would need a publisher account, or each SeerrNG server would need a protocol/API change. Either choice adds signup and support flows plus privacy, availability, security, and ongoing operations. The current project does not have that licensing service.

Google recommends a secure backend for purchase verification, subscription-specific features, real-time developer notifications, and voided purchase handling. The current client acknowledges completed Play purchases, checks the Play account on launch/resume, and caches the entitlement for offline behavior, but it does not validate tokens on a backend. This is acceptable for a prototype; add server verification before relying on the client as the sole gate for paid access. See [Google's one-time purchase processing guidance](https://developer.android.com/google/play/billing/lifecycle/one-time) and [Play Billing backend integration](https://developer.android.com/google/play/billing/backend).

## Decision guide

1. **Keep the lifetime unlock.** A one-time, store-owned permanent entitlement matches the $10 proposal and avoids asking users to subscribe to a client for their own server. The same generic entitlement works in both Android modes.
2. **Keep both modes buildable while deciding.** Use `ads` to evaluate ad revenue and consent friction; use `capped` to evaluate whether 20 free sessions are enough to demonstrate the client. Do not ship both behaviors simultaneously in one build.
3. **Treat the capped build as a product experiment.** It has no ad SDK activity and no hosted cost, but reinstall/data-clear bypasses it. If this is acceptable, server infrastructure is unnecessary. If account-wide enforcement is a requirement, estimate a hosted identity/entitlement service before choosing this option.
4. **Use a subscription trial only if we want ongoing billing.** The trial is a subscription promotion, not a store-provided free counter. Clearly state the trial length, renewal amount, cancellation path, eligibility, and ongoing value before choosing it. It is a poor fit if the intended paid offer remains a one-time lifetime purchase.

At present, the release build still defaults to the ad-supported mode, with ads and billing disabled unless configured. No Play or AdMob product configuration is implied by adding this prototype.

## Validation checklist

### Local mode and cap behavior

- Run `:app:testDebugUnitTest` for both `ads` and `capped` configurations.
- Run `:app:connectedDebugAndroidTest` with `-PandroidMonetizationMode=capped -PfreeSessionLimit=2` to check the visible counter, successful page counting, same-screen server switching, app relaunch, and the exhausted gate.
- Verify an unreachable server does not consume a use; a successfully loaded local test page does.
- Verify the final session stays open, the next launch is blocked, and the cap is not visible in `ads` mode.
- Verify lifetime purchase and restore in Google Play license-test accounts, including pending, cancelled, refunded/revoked, and unavailable-product cases. Debug builds use test ad IDs only.

### Store and release readiness

- Create the package/product in Play Console; configure the `lifetime_unlock` one-time product and regional pricing only after choosing the model and price.
- For ads, create an AdMob app/banner unit, publish the UMP consent message, and set `ADMOB_APP_ID` and `ADMOB_BANNER_AD_UNIT_ID`.
- Configure `ENABLE_PLAY_BILLING=true`; use Google Play license testers and a Play test track for purchase tests. A directly downloaded APK has no Play checkout path.
- Add backend purchase-token verification and refund/voided-purchase handling before public paid distribution if stronger entitlement security is required.
- Rebuild, sign, verify the APK signature, and verify the SHA-256 sidecar using the existing release script. Keep the established release keystore unchanged.
- If distributing through Google Play, plan the Play upload package separately (including the Play-required bundle/signing configuration); the existing release script packages APKs for direct distribution.
- If building an iOS client later, implement StoreKit separately and review the then-current App Store IAP, subscription, external-link, and privacy requirements.
