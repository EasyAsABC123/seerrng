# Artwork reuse verification

Implementation: `bfe4d19fa25878861067d2da1733efe236c31038` on `fix/artwork-reuse`.
PR base: `254e55d6a7fe40dfcf14720e0f2306cb123636bd` (main).

## Browser results

Tested the production build in Chromium using a real local authenticated session and fixture metadata/artwork supplied by an HTTP proxy. Browser routing interception was not used, so native HTTP caching remained enabled. Production was not modified.

| Scenario | Result |
| --- | --- |
| Movie, TV, collection, book, audiobook, album, artist, person: card → detail → back | All eight passed with service workers both enabled and blocked (16 cases). Identical artwork URLs; zero additional artwork origin requests or bytes. |
| 128 CSS-pixel detail poster at DPR 2 | Retained the downloaded 342-pixel image. |
| 208 CSS-pixel detail poster at DPR 3 | Thumbnail remained visible during a 1.6-second delayed response; exactly one 780-pixel upgrade downloaded. Passed with and without service workers. |
| Cold movie navigation and direct book entry | Each loaded one base/provider image. |
| Browser runtime and proxy errors | Zero. |

Service-worker resource timing can report zero transfer size for network-backed responses. Transfer conclusions therefore use the fixture proxy's actual request and byte counters, with browser resource timing recorded separately.

Detailed artifacts: [final navigation matrix](navigation-matrix.json), [recorded scenarios](assertions.json), and [screenshots/recordings](README.md).

## Automated checks

- Final production build, client/server typecheck, lint, and formatting passed.
- Registry and component regression coverage passed, including hydration, actual Next Image URL handling, decoding, concurrency, failed remembered images, distinct artwork identities, lazy loading, and DPR/resize changes.
- Service-worker cache tests passed, including zero fetches for fresh public images, response age and cache directives, expiry, failure fallback, and authorization partitions.
- Cover Art Archive/provider and discovery suite: 87 tests passed.
- Release-note preview and commit hooks passed.
- Full suite completed: 1,848 tests, with 1,836 passing, 4 skipped, and 8 permission assertions failing under this environment's umask `0077`. All 8 failures were in unchanged log/settings/SQLite permission suites that assume `0022`. Rerunning those three suites with that standard mask passed all 23 tests, including every previously failing assertion. No application regression remained.

The implementation was rebased cleanly onto current main before PR publication. Build, typecheck, lint, formatting, release-note preview, all 15 focused files, and the complete browser matrix (16 reuse cases, 2 upgrades, 2 cold entries) were rerun successfully on the final commit. The full suite result above is from the implementation before that rebase; intervening upstream changes cover a release, documentation, back-navigation row sizing, and E2E rate-limit support.

No production deployment was performed.
