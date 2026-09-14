# ADR 0003: Request catalog-series books inside SeerrNG

- Date: 2026-09-14
- Status: accepted for local implementation; proposed for upstream review
- Supersedes: ADR 0002's catalog-only handoff for requesting verified books

## Plan

1. Resolve catalog member identities using exact native backend book lookup,
   explicit Open Library work IDs and valid edition ISBNs. Keep provider metadata
   access in the backend and reject mismatched identity responses.
2. Reconcile complete available evidence, flag conflicts and duplicate work claims,
   and keep failures visible per member. Bound native reads and identity lookups.
3. Feed only verified books into the existing SeerrNG bulk request modal. Preserve
   approvals, permissions, quotas, duplicate handling and backend routing. Default
   the format to the series context for both library and catalog series.
4. Validate exact matches, conflicts, outages, ordinary users, request selection,
   actual API submission and live metadata. Build, record evidence and prepare the
   combined search/request increment for deployment. Keep application source local.

## Ownership

SeerrNG owns discovery, selection, request intent, approval and status. The backend
owns adding, monitoring, acquisition, retries and timing. Reading a catalog must
never add or monitor a book. Future-series subscriptions remain separate work.

## Decision and evidence

Use the existing bulk request endpoint and modal for library and catalog series.
Only verified Open Library work IDs cross that request boundary. Catalog IDs are
backend-scoped metadata identities and are never submitted as request work IDs.
Exact native lookup validates book and format; the optional Chaptarr extension
supplies ISBNs directly from each catalog book's editions. Complete evidence is
reconciled across ISBNs and explicit work IDs. Multiple work matches, cross-book
work collisions, wrong identity responses and partial evidence block that member.
Repeated membership of one catalog book may share its verified work.

The resolver checks 100 distinct members with at most five concurrent native
reads. ISBN search batches contain 25 values and stop at 2,500 total identifiers;
books whose evidence exceeds a limit are unavailable, never silently matched
from a subset. Chaptarr fetches 201 ordered editions to detect its 200-edition
limit. SeerrNG rejects oversized identifier sets and invalid ISBN checksums.
No new runtime dependency, credential, request endpoint, scheduler or database
migration is introduced. Existing routing chooses the configured default backend
unless an authorized user supplies normal advanced options.

The ordinary-user integration test reads a catalog without creating requests,
then submits one selected audiobook and proves it remains pending approval.
This exposed an existing OpenAPI mismatch: embedded request users contain public
identity only and optional routing fields may be null. The schema now describes
that response without exposing account details. Browser fixtures verify selection,
format default, one bulk POST and mobile layout. These fixture checks prove the
request contract; they do not prove live acquisition. Live and deployment results
are recorded separately in the evidence document.

## Limits and rollback

Catalog membership is the provider's returned preview, not a guaranteed complete
bibliography. Resolution does not guarantee that the acquisition provider can
later add a new book. Backend outages remain visible through existing request
status/error handling. Future releases require a backend import list or future
subscription implementation; this change requests selected known members only.
Rollback restores the prior runtime archives; no schema rollback is needed.
