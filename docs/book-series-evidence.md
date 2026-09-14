# Book-series contribution evidence

Recorded locally on 2026-09-13 against upstream `5358da198f8d9f3773c3a2a73418c489df0c0bfd`.
This section records the initial disposable validation; see the live-trial
addendum below for subsequent authorized deployment and library testing.

## Automated validation

- 55 tests across the native series adapter, authenticated series routes, exact
  ISBN matching, existing Readarr/Chaptarr adapter regressions, and SQLite migration.
- 16 existing bulk-request tests: deduplication, skip handling, server/profile
  overrides, quota behavior, and request processing remain intact.
- Server and client typechecks; production server and Next.js builds.
- ESLint, Prettier, attribution check, whitespace check, and release-note preview.

```sh
node server/test/index.mts server/api/servarr/readarr.series.test.ts server/routes/bookSeries.test.ts server/api/openlibrary/openlibrary.test.ts server/migration/sqlite/1784300000000-AddBookSeries.test.ts server/api/servarr/readarr.test.ts
node server/test/index.mts server/routes/request.test.ts --test-name-pattern=bulk
pnpm typecheck
pnpm build:server
pnpm build:next
pnpm attribution:check
pnpm release-notes:preview --base 5358da198f8d9f3773c3a2a73418c489df0c0bfd --head HEAD
```

Environment: Node 22.23.2, pnpm 10.24.0. Tests requiring HTTP listeners and build
subprocesses ran outside the restricted process sandbox, using local fixtures.
No production configuration or metadata token was supplied.

## Browser and backend interoperability demonstrations

The built Next.js application was exercised in Chromium with intercepted fixture
API responses. Checks cover book → series navigation, the native management URL,
ambiguous/unmatched entries, distinct works sharing a title, missing ebook
selection, extras opt-in, no author bibliography expansion, and a 390px mobile
viewport without horizontal overflow. Runtime JavaScript errors: zero. The
metadata settings page has no added Hardcover token control.

Separately, the real SeerrNG adapter read a locally built Chaptarr instance with
its real migrated SQLite database and synthetic rows: native book 701 resolved
to author 700, series 710 contained only member 701, and management path was
`/series/710`. It used Chaptarr's existing API key and no separate Hardcover token.
This proves native API interoperability beyond the mocked HTTP contract tests.
It does not claim an end-to-end live acquisition.

## Behavior/value comparison

| Trigger | Baseline | Contribution |
| --- | --- | --- |
| Open a bound book with series metadata | No series navigation from book details | One link per exact membership and format |
| Select books in a series | Individual search/request workflow | Existing bulk selection with verified work IDs |
| Two different works have the same title | Bibliography dedupe can collapse title matches | Series selection preserves distinct work identities |
| Backend lacks series endpoint | No series feature | Graceful unsupported status; existing requests remain |
| Backend metadata is unavailable | No series feature | Visible retryable failure; no requestable guessed matches |
| Manage a Chaptarr series | Navigate separately in backend | Request-manager link to native series page |

## Limits of the evidence

Readarr/Bookshelf compatibility was checked against source and contract fixtures;
a running Bookshelf server was not modified or used for acquisition. PostgreSQL
migration execution and very-large-catalog latency remain unmeasured. The browser
request response is a fixture; actual permission/quota/request processing is
covered separately by API tests. Real provider completeness, indexer results,
downloads, notifications, long-term sync, and operator adoption remain unproven.
These are reasons to gather deployment feedback before proposing upstream, not
reasons to overstate this increment as a future-series watch.

The workspace contribution dossier retains raw logs, browser scripts/screenshots,
patches, and JSON reports. This repository record is intentionally portable and
contains no credentials or machine-specific artifact paths.

## Authorized live-trial addendum

The contribution was rebased onto upstream `ec45661b` (v3.21.0); the new book
layout retains series navigation and its terminology checks pass. The integrated
adapter/series/request suites passed 189 tests, and the Open Library/book-route
suites passed 24 tests. Native edition enrichment additionally passed 28 adapter
and series-route tests, including wrong-book and authentication-failure cases.

The live Chaptarr build passed native reads for all 710 series (88 with current
members, 622 empty), 89 same-state monitoring calls, and separate audiobook and
ebook monitoring round-trips. All 183 books retained their original format
monitoring states at the recorded comparison times.
The first SeerrNG discovery audit queried 47 canonical work IDs and found two
Bobiverse format pages. That was a restricted subset: discovery also accepts saved
aliases. The expanded audit queried all 128 known work IDs (47 canonical, 81 aliases)
and discovered 64 format-specific native series pages. Every discovery call
returned HTTP 200: 68 matched, 3 partial, 52 unavailable, 5 unsupported/unbound.
The snapshot still contained 694 stale format bindings; identity and binding
coverage prevents claiming every library series is discoverable.
A separate native edition endpoint was required to obtain ISBN evidence for
series members; this prompted the regression fix included here.

Actual HTTPS routes reached their expected login boundaries. An authenticated
browser session was unavailable, so the deployed signed-in UI and end-to-end
acquisition remain unverified. No application branch or PR was published.

A second upstream refresh incorporated `949700bc`, including its runtime
dependency updates and `better-sqlite3` driver. The series migration test now uses
that driver. All 223 selected adapter, series, request, identity, book-route,
legacy-migration, session-store and concurrent startup-migration tests passed.
The runtime dependencies must be rebuilt for the deployment platform; the old
image dependency set is no longer compatible with this source baseline.

Repeated live reads exposed a missing Chaptarr management URL on warm cache hits.
The adapter now resolves backend capabilities before using a cached catalog.
All 49 affected adapter/series tests pass, including fresh-adapter warm-cache
assertions for Readarr, Bookshelf and Chaptarr in both formats.


The final deployed application commit `a37eb1c6` passed all 64 discovered series
page checks: 37 audiobook and 27 ebook pages, representing 113 distinct native
books. Every page returned correct native membership and a Chaptarr management
URL. Two initial HTTP 503 responses (The Cosmere ebook and Red Rising Saga
audiobook) succeeded on retry; their causes were not established. All six repeated
reads of the two Bobiverse pages also retained the management link.

Across overlapping series pages, 93 entries matched, 80 were ambiguous and 18
were unmatched; these are entry occurrences, not distinct-book totals. Ambiguous
or unmatched entries remain unrequestable. The other 24 nonempty native series
had no saved Open Library work IDs on their corresponding SeerrNG bindings.
Native API coverage is complete for this snapshot, while SeerrNG discovery and
request eligibility remain narrower. Confidence is high for these API measurements;
authenticated deployed UI behavior and acquisition are still unverified.

## Two-book acquisition follow-up

A later live trial requested the first two Expanse audiobooks through SeerrNG's
normal request API. Both downloaded and imported through Chaptarr, reached
`available`, and had actual library files matching their recorded sizes. Both
work IDs then discovered the same series at positions 1 and 2, with exact native
membership and working management URLs in the API responses. The main series had
24 provider-known members and its chronological variant had 23. One initial
metadata 503 succeeded on retry. No remaining volumes were requested.

After import, the new native series monitor turned the two selected audiobook
members off and back on. Reads verified all 279 current book records and unchanged
author policy. Provider metadata population had added 96 catalog records; it did
not request 96 downloads. The provider's existing author cross-format sync policy
also initially monitored two ebook companions. The trial cleared only those ebook
flags through the scoped series endpoint, preserving all 183 pre-existing books'
monitoring states. Add/request policy interactions warrant a separate review.

This supersedes the earlier acquisition-untested statement for these two books.
Confidence is high for request, import, availability and series API behavior.
Playback remains unproven: both releases use xHE-AAC. The deployed FFmpeg 6.1.1
probe could not handle audio object type 42; FFmpeg 9.0.1 identified the codec but
also failed a short sample decode. The original library files were untouched.
Authenticated deployed browser click-through and future-series watching remain
outside the demonstrated result. No application branch or PR was published.

## User-submitted series request and playback follow-up

The next series member, Abaddon's Gate, remained ambiguous and unrequestable.
Cibola Burn had a verified work identity. A one-item call to the series dialog's
bulk endpoint created an audiobook request, returning HTTP 207 with one success
and no failed/skipped entries. The user subsequently reported submitting through
SeerrNG; the live record created 25 seconds later requested both formats. Both
requests reached available state after provider import. This is user-reported UI
participation corroborated by request records, not instrumented browser coverage.
The ebook grab in this overlapping test cannot be attributed solely to companion
synchronization because a both-format user request exists.

Audiobookshelf's actual FFmpeg 8.0.1 failed to decode the three selected Expanse
xHE-AAC files, while an existing Dungeon Crawler Carl AAC-LC file passed the same
check. That finding is specific to the releases/decoder path, not all M4B files.
After a verified backup, an approved Jefferson Mays MP3 release replaced only
Cibola Burn's incompatible audio. All 64 imported MP3 files parsed and passed a
five-second decode sample using Audiobookshelf's runtime; its automatic scan
indexed the replacement. The first two Expanse files remain unchanged.

The user confirmed actual playback and seeking work for the Cibola Burn
replacement. Confidence is high for this tested request/import/playback path,
combining measured provider outcomes with direct user acceptance. Regular-user permissions,
fully instrumented UI interactions, other live backends and unresolved identity
reconciliation remain gaps. These playback findings should inform a separate
provider compatibility policy; this series contribution does not redefine file
availability as proof of decodability or create new acquisition scheduling.


## Expanse codec replacement follow-up

The user subsequently authorized replacing the first two Expanse trial files.
Both originals were backed up and SHA-256 verified. Chaptarr imported compatible
Jefferson Mays AAC-LC M4B replacements for Leviathan Wakes and Caliban's War.
Initial MP3 torrents stayed at zero transferred bytes and were removed without
blocklisting; approved Usenet releases supplied the successful replacements.

Audiobookshelf's actual FFmpeg 8.0.1 decoded five-second samples at the beginning,
midpoint and near the end of both replacements. Its automatic scan retained the
existing item IDs and indexed the new files without missing/invalid flags. The
queue was empty and all 279 book monitoring states remained unchanged. Confidence
is high for those measured outcomes. The user confirmed actual playback and
chapter seeking work for both replacements. Full-duration decoding and content
completeness were not established.
The replacement durations are 69,079.135873 and 71,411.580317 seconds; the latter
is shorter than the original Caliban's War release (75,608.236916 seconds).

These successful AAC-LC M4B checks narrow the failure to the tested xHE-AAC
releases and decoder path. No global quality/player settings were changed, and
this operational repair adds no series scheduling behavior.

## Direct series search

Added a Book Series entry to Search and a standalone `/book-series` page. Native
library inventory bypasses SeerrNG work bindings and opens existing series URLs.
Recognized Chaptarr catalog results open a separate read-only preview using its
existing search/lookup APIs. Provider credentials stay in the backend. Readarr
and Bookshelf catalog lookup is not assumed; their native library contract is
covered by adapter fixtures. See ADR 0002 for bounds and ownership decisions.

All 38 series route/adapter tests passed, including ten new search/preview cases.
Another 47 adapter, search-filter/input and series-migration regressions passed.
Server/client typechecks, changed-file ESLint, translation extraction/check,
current-batch/style contracts, attribution, and server/Next production builds
passed. Browser fixtures passed global search entry with typed query/format,
library-result navigation, catalog preview without request controls, mobile
layout, partial-result retry, disabled state, and absence of backend mutations or
runtime JavaScript exceptions. The dev preview exposed an existing duplicate
Audiobooks sidebar-key warning; no clean-console-warning claim is made.

A read-only adapter check against the deployed Chaptarr completed in 3.462 seconds.
Its native inventory returned 83 audiobook series with no partial/truncation flag,
including Dungeon Crawler Carl and the Expanse variants. Catalog search returned
six series. The main Expanse search result advertised nine books, while the
backend lookup returned seven preview books and a count of seven. This is provider
preview incompleteness, not proof of a complete remote bibliography; the UI states
that previews may omit books. No books were requested, added, or monitored by this
check. Confidence is high for observed search/navigation behavior and unknown for
catalog completeness beyond the returned provider data.

Screenshots, browser fixture script/report, live adapter script/redacted output,
and build/regression logs are retained in the operator's `series-search-evidence`
directory. New code remains local until separately deployed; no source branch or
PR was published for this search increment.

## Catalog requests and latest-upstream validation (2026-09-14)

This increment supersedes the prior catalog-preview-only handoff. Catalog books
with a verified work identity now enter the existing bulk request modal directly
inside SeerrNG. Both library and catalog series default to their displayed format.
The implementation and limits are recorded in ADR 0003.

- SeerrNG application runtime: `fd1e1a5c6407bd96d673a0ac8bdfce02c3a0cbec`,
  including upstream/main `77a52d0d` (v3.21.1) and origin/main `a1b22625`.
- Chaptarr optional catalog ISBN extension: `ac0f41b342b817820889a64ba8e372eabe581a6f`.
- Focused/related SeerrNG tests: **211 passed**, covering resolver conflicts,
  exact identities, API permissions, bulk requests and newly merged upstream
  query/session-security behavior. Production build (including translation and
  current-batch gates), TypeScript and focused lint passed.
- Chaptarr focused series/identifier tests: **19 passed**; net10.0 Release publish
  passed. The existing NU1902 warning was retained and did not introduce a new
  dependency change.
- Production browser fixtures: ordinary requester, verified members only,
  audiobook default, deselect one book, one bulk POST, one created result,
  desktop/mobile screenshots and no JavaScript exceptions. The backend API
  integration independently creates exactly one pending-approval audiobook
  request and proves catalog reads create none. Fixture browser results do not
  establish live downloading.
- Live Wayfarers preview: **two matched, two ambiguous, zero unavailable** after
  the Chaptarr extension. Before the extension all four were unavailable because
  individual native Hardcover book lookups returned HTTP 503. Exact ISBN lookup
  returned backend results for both matched members. One result was a translated
  edition; the normal acquisition path remains responsible for edition/language
  choice. No title-based identity override was added.

Raw sanitized records are in the local sibling `series-catalog-request-evidence`
folder: `final-tests.log`, `chaptarr-tests.log`, `seerrng-build.log`, browser
`report.json`, `live-resolution.json`, `live-acquisition-lookup.json`, artifact
manifests and release-note preview. Private keys/database backups are kept outside
application repositories. Application source remains local; no PR was opened.

### Post-rollout server-zero correction

Live authenticated API checks found catalog previews returned HTTP 400 for the
first configured book server (`id: 0`). The query schema and route had incorrectly
required a positive ID. Runtime `54bb6f4b` accepts valid zero-based configuration
IDs; all 19 route tests pass again, including normal pending approval through
server zero. The backend was rebuilt with the unchanged validated frontend and
production dependencies. Fleet deployment commit `24afb5a` supersedes `b4117ed`.
The HTTPS ingress continues through Authentik. Automated browser data checks may
use a UI authentication fixture with real API-key-authorized reads; these are
separate from actual signed-in SSO acceptance.
