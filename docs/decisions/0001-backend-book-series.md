# ADR 0001: Read book-series membership from the configured backend

- Date: 2026-09-13
- Status: accepted for this local implementation; proposed for upstream review
- Upstream baseline: `5358da198f8d9f3773c3a2a73418c489df0c0bfd` (SeerrNG v3.20.4)
- Confidence: high for the ownership boundary and tested contracts; live operator value remains unmeasured

## Problem and value hypothesis

A reader on a book details page cannot navigate its series and select related
books/formats together. SeerrNG already knows the library-manager book identity,
and Readarr-derived servers already expose local series membership. Requiring a
second account duplicates metadata configuration and can disagree with the
backend that actually acquires the books.

The value hypothesis is fewer navigation steps and fewer manual title searches,
while preserving request approvals and avoiding unrelated author acquisitions.
The reproducible demonstrations establish behavior, not adoption or download
success rates. No upstream endorsement is assumed.

## Decision

Use native `GET /api/v1/book/{id}` and `GET /api/v1/series?authorId=...` against the
configured Readarr-compatible server. On Chaptarr, bypass the book facade for
native IDs and relationships. Keep dialect/provider detection already owned by
the existing adapter. Use exact membership plus the configured format, never a
series title heuristic. Probe capability through the response: 404/405/501 means
unsupported; authentication failures, malformed data, and outages are errors.
One failing format must not hide another format's valid results.

Keep a small SQLite/PostgreSQL table for stable local URLs. The identity is a
server ID plus endpoint fingerprint and format, paired with the native series ID.
An author ID is a reload anchor for backends that only list series by author;
it is not part of series identity, so multi-author series share a page. Update
that anchor when a member is opened. If the anchor loses its last membership,
opening another current member repairs it; until then the page can return 404.
No title-based migration or cross-backend merging is attempted.

Reuse established canonical library identities and exact, complete ISBN matches
to Open Library work IDs. Both conflicting ISBN matches and multiple native books
claiming one work are ineligible. No arbitrary provider ID can be submitted as an
Open Library request. Treat primary/extra classification as optional evidence.

SeerrNG owns discovery UI, request intent, permissions, approvals, and status.
Existing request processing owns adding requested books to the selected backend.
The backend owns monitoring and all acquisition scheduling. The series page never
creates a scheduler, author watch, import list, or automatic future request.
A native management link is exposed only for a recognized Chaptarr server and
request managers, using the existing external URL/base-path convention.

## Alternatives and rejected approaches

1. **Direct Hardcover integration:** an earlier local prototype implemented this
   at `f96c9146a9771a76b400c0293e64162de6c23fb0`, preserved on
   `archive/book-series-hardcover-prototype`. Superseded because it required a
   second token and made SeerrNG own a competing catalog. Its exact identity and
   request-selection safeguards are retained. No Hardcover package, token setting,
   runtime configuration, or external Hardcover call is introduced here.
2. **Goodreads API key in SeerrNG:** not needed for library membership and does not
   solve ownership or capability differences. Any provider credential stays with
   the backend using that provider.
3. **Author-wide monitoring as series watch:** rejected because an author can have
   unrelated series and standalone books. Future author books are not equivalent
   to future series books.
4. **Chaptarr-only UI or a guessed common management URL:** rejected as the default.
   Native navigation is an optional provider capability; the SeerrNG series page
   remains backend agnostic within the supported API contract.
5. **Persist a complete series catalog:** rejected for this increment. The local
   table holds navigation identity only; refreshed backend metadata is authoritative.
6. **Full future-series subscription in SeerrNG:** deferred. A later contribution
   requires a backend capability with explicit policy, lifecycle, idempotency,
   status, and permission semantics. It must reuse backend import/discovery timing.

## Compatibility and limitations

| Backend | Membership browsing | Request path | Native management link |
| --- | --- | --- | --- |
| Readarr compatible series API | Yes, known local members | Existing Readarr request path | No inferred URL |
| Bookshelf / BookshelfNG | Yes, known local members | Existing Readarr request path | No inferred URL |
| Chaptarr | Yes, native resources, selected format | Existing Chaptarr adapter/facade | Yes, request managers |
| Missing series endpoint | Hidden as unsupported | Existing individual-book requests | None |
| Audiobookshelf sync without an *arr binding | No series discovery in this increment | Unchanged configured request backend | None |

A backend database reset at the same endpoint can reuse IDs. Multiple copies
mapped to one Open Library work are conservatively blocked from bulk requests.
Large series can require many native reads and ISBN queries; bounded batches,
cache, rate limits, and explicit 500-entry truncation limit work, but production
latency on very large catalogs has not been measured. Errors intentionally stop
requestable results when identity evidence is incomplete.

## Rollout, rollback, and contribution boundaries

The initial validation used disposable services. A later operator-authorized
homelab trial deployed both contributions without publishing application branches
or opening a PR. Deployment configuration alone was pushed to the operator repo.
The migration is additive and reversible; SQLite rollback is tested. PostgreSQL
uses the equivalent migration but requires a database integration run before a
PostgreSQL deployment. Reverting UI/routes removes the feature; the identity table
contains no acquisition policy and may be retained or dropped after backup.

Before proposing upstream: reproduce the examples on a disposable real backend,
collect operator feedback about the limited library scope, and ask maintainers
whether this fits their desired book-provider direction. Keep the contribution
focused and offer reproducible evidence with explicit unknowns. Future monitoring
should be proposed separately if maintainers want it, not smuggled into a UI patch.

## Live-trial decision: native edition identity evidence

The Chaptarr 0.9.964 native book endpoint omits editions. Series detail resolution
therefore reads the native `/edition?bookId=...` endpoint when inline editions are
absent. Discovery does not need this extra lookup. Validate every returned edition
against the requested native book ID and bound the response to 5,000 editions.
Unsupported endpoints preserve unresolved/previously established identities;
authentication failures, outages and mixed-book responses stop resolution. Keep
these reads on the native API even when acquisition uses a compatibility facade.

The real trial also exposed stale bindings after changing library servers and low
canonical Open Library coverage. These are distinct from native series membership.
Do not guess work identities or call this broad catalog coverage. A separate
identity reconciliation design is required before proposing wider adoption.

Native catalog caches are shared between short-lived adapter instances. Resolve
provider capabilities before reading the catalog cache; otherwise a warm-cache
request can lose its Chaptarr management URL even though the catalog is valid.
Contract tests reopen the catalog through a fresh adapter, prove the data read
is cached, and assert the management capability for each backend and format.


## Live-trial decision: coverage evidence and reconciliation

Discovery accepts all saved Open Library work identifiers, including aliases.
Auditing only canonical identifiers understated coverage: 47 canonical IDs exposed
two pages, while the complete set of 128 known IDs exposed 64 format-specific
native series records. These can include overlapping or translated series records;
they are not necessarily distinct story universes. Request eligibility remains
a separate exact-identity check. Count discovery, native membership and requestable
entries separately when presenting evidence.

A normal backend scan refreshed current bindings but left historical native IDs
from a previous library. Do not silently clear or reassign them in this navigation
change: numeric IDs can be reused across backend resets, and title matching cannot
prove identity. A follow-up reconciliation design should provide a preview with
proven provider/format/work matches, explicit conflicts, and reversible changes.
Missing native bindings and missing work identities need separate classifications.
No bulk acquisition or new metadata-provider dependency is justified by an audit
coverage gap alone.
