# ADR 0002: Search series through configured book servers

- Status: accepted for local implementation; proposed for upstream review
- Date: 2026-09-14
- Supersedes: ADR 0001's navigation-only discovery entry point

## Problem

A reader who knows a series name should not need to find a book first. Requiring
an existing SeerrNG work binding also hides native library series when book
identity reconciliation is incomplete.

## Decision

Expose authenticated series search separately from ordinary movie, television,
book and music search. Carry the current query and book format into a Book Series
entry on the search page. Label each result with server, format and library or
catalog source. Search and preview are read-only with respect to the backend.

Enumerate native author identities and their series resources on compatible
Readarr, Bookshelf and Chaptarr servers. Match all case-insensitive query words
against native series titles. Deduplicate multi-author memberships by native
series ID within the configured endpoint and format. Reuse the existing local
series URL identity; do not require or create a book/work binding to find it.

For recognized Chaptarr servers, additionally query its existing native search
API and retain series results with a supported catalog identity. Use its native
series lookup API for previews. The backend's search provider identity takes
precedence over its preferred foreign alias; reject a mismatched lookup response.
No Hardcover package or provider credential is added to SeerrNG. Chaptarr's own
catalog configuration must already work. Other server catalog dialects require
explicit adapters; a generic /search route is not assumed to mean series search.

Library results open existing SeerrNG details and verified requests. Catalog-only
results open a separate preview, with no request or monitor controls. A provider
book identifier is not an Open Library work ID. Request managers can open the
existing native Chaptarr search/add flow; ordinary readers receive no management
URL. This handoff does not alter Chaptarr's existing add-series semantics or claim
the scope guarantees of the separate current-member monitor endpoint.

Catalog links include the configured server ID, endpoint fingerprint and format.
Changing a server endpoint or format invalidates those links. No catalog payload
is persisted and no schema migration is needed. Local library navigation uses
ADR 0001's existing identity table and inherits its backend reset limitations.

## Bounds and failure behavior

Queries contain 2–200 trimmed characters. The authenticated API shares the series
limit of ten requests per user per minute. Search is submitted explicitly rather
than issuing a request for every keystroke. Provider reads use the existing
five-minute cache. Each inventory scans at most 250 authors with five concurrent
series reads; the first wholly unavailable/unsupported batch stops the scan.
Each server contributes at most 100 library and 100 catalog results, with an
explicit truncation notice. These are bounds, not a complete large-catalog claim.

Preserve successful library/catalog results when another source fails. Distinguish
partial, unavailable, unsupported, disabled and empty results. Authentication or
malformed metadata must not become an empty-success response. Do not send upstream
error payloads, configuration tokens or provider book IDs in preview responses.

## Alternatives and deferred work

- Searching only saved SeerrNG series rows misses undiscovered native series.
- Direct Hardcover/Goodreads calls would duplicate provider ownership and credentials.
- Title-based merging across servers or between local/catalog identities risks
  joining different series; retain separately labeled results.
- Automatically adding a catalog series from a search or preview would introduce
  acquisition side effects into navigation and bypass verified request semantics.
- Catalog-to-request identity reconciliation and future-release watching remain
  separate work. Monitoring, discovery schedules and acquisition belong to the backend.

## Validation and rollback

Adapter HTTP tests cover three dialects, both existing format paths, native URL
bases, multi-author deduplication, catalog identity precedence, unsupported catalog
capabilities, partial inventory and mismatched previews. Authenticated API tests
cover unbound library discovery, stable URLs, format selection, error schemas,
reader/manager links and endpoint replacement. Browser fixtures exercise search,
local navigation, preview, mobile layout and retries separately from live provider
checks. Exact outcomes are recorded in book-series-evidence.md.

Rollback removes the additive search routes and pages. Existing series URLs and
book request/monitoring state retain their previous behavior. No source PR is
opened by this local decision record.
