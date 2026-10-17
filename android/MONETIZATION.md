# Android lifetime unlock and pricing

## Decision

When Play Billing is enabled, the Android app is free to download with a local preview: the first 20 successful server sessions on an installation are free. A one-time, non-consumable Google Play product named `lifetime_unlock` grants unlimited sessions to the Play account that bought it. There are no ads, advertising SDKs, ad consent prompts, or ad-related data collection in the Android app. Builds made before the Play product is configured are unlimited free evaluation builds and do not show purchase controls, so they do not lock users out without a working purchase path.

**Recommended US price: US$4.99 once.** Google Play should localize the configured price for each storefront. The app uses the price returned by Play Billing, so the checkout sheet and button show the user's actual local price.

## Price research

I compared apps around self-hosted media and Seerr clients:

| Comparable | Observed price/model | What it includes | What it suggests |
| --- | --- | --- | --- |
| [ServerrSeerr](https://apps.apple.com/us/app/serverrseerr/id6759878396) | US$1.99 paid iOS app | A direct Seerr companion | A low-price reference for a narrow Seerr-only client; it is an Apple listing, not an Android listing. |
| [Arrcade](https://arrcade.co.uk/) | £5.99 one-time Pro unlock | A broader app supporting 13 media services, multiple connections, and push notifications | A richer self-hosted companion can support a price near US$6 equivalent. |
| [Plezy](https://play.google.com/store/apps/details?hl=en&id=com.edde746.plezy) | About US$5.99 in the observed US Play storefront; regional prices vary | A full Plex/Jellyfin/Emby media player with playback features | A broader media app occupies the roughly US$6 one-time range. |
| [Kochab](https://play.google.com/store/apps/details?id=io.kochab) | Free | A broad self-hosted media companion with all listed features included | Free alternatives exist, so the paid benefit must be clear and the free preview must be useful. |
| [Underseerr](https://underseerr.lusk.app/) | Free and open source; optional paid hosted features | Seerr-focused web companion with optional hosted push and themes | The Seerr ecosystem has a free baseline; charging should be for the convenience of this native client, not server access. |

US$4.99 lands between the $1.99 direct Seerr reference and the roughly $6 broader apps. The Android client is a focused Seerr WebView companion, while the SeerrNG web app remains free and the user supplies their own server. A 20-session preview lets people test their server before paying. US$10 would price this narrower client above broader one-time media apps; the lower US$4.99 price is easier to justify and still leaves room to support maintenance.

These are storefront snapshots, not a universal price list. Prices vary by country, taxes, promotions, and date. Choose US$4.99 as the US base price in Play Console, then review Play's suggested local prices before publishing.

## What counts as a session

- The default allowance is 20 successful server sessions per installation. `FREE_SESSION_LIMIT` or Gradle's `-PfreeSessionLimit` can set a positive test/build value.
- A session is counted only after the first main page successfully finishes loading. A bad URL, offline server, HTTP error, or failed page load does not consume a session.
- The first successful connection in one open app session counts. Switching among saved servers, backgrounding, and resuming does not count another use.
- After the final free session is counted, that open session remains usable. On a later app launch, another server session requires the lifetime unlock.
- The count is stored in private app preferences and applies across servers saved in that installation. Clearing app data or reinstalling resets it. It is a simple preview counter, not tamper-resistant licensing.
- The count does not track actions inside SeerrNG, sync across devices, or send usage data to Snapetech or the user's server.

This needs no hosted quota service because the client connects to independently operated servers and has no central SeerrNG account. A server-side quota would require a new identity/entitlement service or protocol changes to every connected server.

## Google Play setup

The Play purchase is not ready until all of these are complete:

1. Create the Play app record for `org.snapetech.seerrng` and upload a signed AAB to a test track.
2. Create a one-time product whose product ID is exactly `lifetime_unlock`.
3. Set the US base price to US$4.99 and review the regional prices Play proposes.
4. Add license testers and test purchase, restore, pending, cancellation, refund/revocation, and unavailable-product states from the Play-distributed test app.
5. Set the GitHub Actions repository variable `ENABLE_PLAY_BILLING=true` only after the product is active and the release build has passed those checks.

Until billing is enabled, the release build hides purchase controls and leaves the app unlimited. The signed GitHub APK is useful for direct evaluation, but checkout and purchase restoration rely on Google Play. The app checks owned purchases at launch and resume, acknowledges completed purchases, and caches the local entitlement for offline use. It recognizes the old `no_ads_lifetime` product ID to preserve restore support for existing owners.

The app does not send purchase tokens to a publisher backend. This keeps the initial product simple, but it means the local entitlement is not authoritative against a modified client and the publisher does not receive real-time refund/revocation events. Add backend verification and voided-purchase handling if the product needs stronger enforcement or account-wide entitlement state.

## Other monetization options

| Option | Store support | Hosted service | Fit here |
| --- | --- | --- | --- |
| One-time lifetime unlock | Google Play non-consumable product | No for device-local entitlement; backend recommended for authoritative verification, refund handling, or cross-device accounts | Best fit for a small utility used with the user's own server. |
| Subscription with a free trial | Play subscription offers can start with a trial and renew into recurring billing | No for store-account status; backend recommended for robust verification and notifications | Poor fit without ongoing hosted value. Users would pay repeatedly for a client to their own server. |
| Local time-limited access or action quota | Implemented by the app; the store does not provide an arbitrary session counter | No for per-install counter; yes for reliable account-wide enforcement | Reinstall or app-data clearing can reset it. The current 20-session counter is this kind of preview. |
| Hosted quota or publisher account | Custom app/server integration | Yes | Adds account, privacy, security, availability, and operating costs; unnecessary for the current preview. |

Google Play documents [one-time products](https://developer.android.com/google/play/billing/one-time-products), [subscriptions](https://developer.android.com/google/play/billing/subscriptions), and [billing test setup](https://developer.android.com/google/play/billing/test). Apple uses separate products and purchase records; its reference model is documented under [in-app purchase types](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types). A Play purchase does not unlock an Apple build.

## Validation checklist

- Run `:app:testDebugUnitTest`, `:app:connectedDebugAndroidTest`, and `:app:assembleDebug` with `-PfreeSessionLimit=2`.
- Verify successful pages count once, failed loads do not count, switching servers in one app session does not spend another use, and a new launch is blocked after the cap.
- Test Play purchase and restore through a Play test track before enabling the product in a public build.
- Verify release APK and AAB signatures and SHA-256 sidecars with `scripts/build-android-release.sh`.
- Keep the established release keystore unchanged. The AAB is uploaded to Google Play; the APK is for direct installation and GitHub distribution.
