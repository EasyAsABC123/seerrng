# Book-series contribution evidence

Recorded locally on 2026-09-13 against upstream `5358da198f8d9f3773c3a2a73418c489df0c0bfd`.
No PR, push, deployment, or real-library mutation was performed.

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
