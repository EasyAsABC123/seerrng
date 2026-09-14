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
members, 622 empty), 89 same-state monitoring calls, and an audiobook monitoring
round-trip. All 183 books retained their original format monitoring states.
The SeerrNG discovery audit covered all 47 canonical book records after a normal
backend sync. It exposed only two format-specific Bobiverse pages; 694 stale
format bindings and missing canonical identities prevent claiming full coverage.
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
