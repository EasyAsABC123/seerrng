# ADR 0007: Request ongoing series monitoring in the book backend

- Date: 2026-09-15
- Status: local implementation; not submitted upstream or deployed
- Confidence: high for fixture-tested request and format boundaries; live acquisition unverified

SeerrNG's earlier Request Series action requests selected current books. It does
not create a continuing series subscription. The user wants SeerrNG to submit
that subscription to Chaptarr, with Chaptarr owning discovery and acquisition.

## Decision

Add a separate Monitor Series action to catalog previews and supported library
series pages. Keep Request Selected Books for individual selections. Each watch
has an exact provider identity, backend endpoint scope, and one format. The
existing grouped search retains separate format links. A reader can monitor both
formats through their respective links; the backend stores them independently.
Never infer identity from a title or merge Hardcover and Goodreads identifiers.

SeerrNG checks an explicit versioned backend capability before offering writes.
The Readarr adapter uses Chaptarr's native series/watch API, not its book facade.
Older Chaptarr versions and other book servers continue supporting their existing
flows and report ongoing monitoring as unsupported. There is no new metadata API
key or polling job in SeerrNG.

Persist a dedicated request record rather than inventing an Open Library work
for a series. Book request permissions govern submission; book auto-approval is
reused for users without quotas or service overrides. Finite book quotas and
service overrides require manager approval: future backend additions cannot be
charged as a fixed collection of SeerrNG book requests. The watch uses the selected
server's configured destination/profile defaults. Its manager approval is an
explicit ongoing commitment, including backend-discovered books which are not
individual SeerrNG requests. Chaptarr's own exclusions and metadata rules apply.
Per-book SeerrNG availability, blocklist matching, notifications and quotas are
not a second filtering pipeline for backend discovery. Requests needing per-book
SeerrNG control should use Request Selected Books instead.

Pending requests make no backend writes. Managers review them via Requests →
Series Monitoring Requests, and may approve/retry, decline pending requests, or
stop watches. User/security and service-configuration admission protect writes.
Only the requesting user and request managers list a request; live enabled state
on a shared series page remains visible to signed-in users.

A unique scope/provider constraint and in-process admission serialize submissions.
Backend create/update is independently idempotent. Persist failures without
claiming activation; retries reuse the same backend watch. Server endpoint or
format changes invalidate the saved scope. API errors never expose backend secrets.
The page checks actual backend enabled state; the queue labels its persisted
status as last confirmed. A watch enabled in Chaptarr is not proof of a download.

## Chaptarr lifecycle

A Series Watch import list stores the provider identity and selected format.
Hardcover supports primary-only or extras-inclusive discovery. Goodreads requires
including extras because this source does not classify primary members. Catalog
fetches are paginated and fail on missing identity, provider errors, incomplete
pagination, or missing author identity. Provider configuration remains in Chaptarr.

Chaptarr queues the initial import-list sync. Subsequent refreshes use its existing
scheduler, minimum refresh interval and failure backoff. Each sync monitors the
specific returned books. It does not enable an author-wide future-book policy.
Already imported companion formats and unrelated books must be unchanged. Missing
provider metadata follows the existing pending-author-import lifecycle. A new
book must become available through Chaptarr's normal metadata refresh/import flow
before it can be acquired; there is no guarantee of instant discovery or release.

Stopping disables the import list. It does not remove downloaded files, unmonitor
previous books, cancel already queued work, or revoke another tool's monitoring.
Those actions remain in Chaptarr. Operators can inspect provider health and manage
the persisted watch under Chaptarr's import-list settings.

## Validation and rollback

The workspace artifact `series-watch-evidence` contains logs and browser evidence. Tests cover authorization, pending approval,
concurrent submissions, failed dispatch, scoped identity, format-specific native
HTTP requests, migration uniqueness/rollback, catalog pagination/later additions,
and actual import-list sync without companion/unrelated mutations.

SQLite and PostgreSQL receive the same request-table migration; executable
migration validation currently covers SQLite. The Chaptarr watch reuses existing
import-list persistence. Rollback must disable these new import lists before
removing the Chaptarr implementation, as older versions cannot load that provider.
SeerrNG rollback leaves request records and enabled backend watches intact. No
application source branch, upstream PR, or deployment is part of this local change.
