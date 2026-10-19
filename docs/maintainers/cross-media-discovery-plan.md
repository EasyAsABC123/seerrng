# Cross-Media Discovery and Edition Plan

Written 2026-10-18. Maps the seven-opportunity recommendation set onto SeerrNG,
ChaptarrNG, BookshelfNG, QuestarrNG, ROMarrNG, and slskdN, and adds the shared
foundations the recommendations did not cover.

Status: **built as one release** (see "Build record" at the end). The sections below are the original plan; deviations are listed in the record. File paths below were
confirmed to exist in this checkout on the date above. Sibling-repo file names
come from the recommendation's inspected revisions and a directory listing;
re-read each before starting its phase (the same rule as
`ng-ecosystem-integration-plan.md`). Read `ui-style-standard.md` and
`ui-fix-it.md` before any interface phase.

## Ground rules (inherited)

1. SeerrNG stays the request layer. Companions own acquisition.
2. Every integration is optional and absent when unconfigured, never an error
   or a blank panel.
3. Capabilities are negotiated through each companion's contract
   (`server/api/software/*.ts`, `SEERRNG-INTEGRATION.contract-v2.json`) before a
   feature appears. Older companions degrade to today's behaviour.
4. Uncertain relationships are shown as uncertain, never silently inferred or
   dropped (acceptance ledger, "Series collections and franchise groups").
5. Contract tests with recorded fixtures; no live targets in tests.
6. Each phase ships separately with a `release-notes/` fragment written for
   users/operators; internal-only commits carry `release-note: none`.
7. Every companion change is committed and pushed to that repo's own remotes
   (SeerrNG: `origin` and `gitlab`).

## What the recommendation missed (added scope)

| Gap | Why it matters | Where it lands |
| --- | --- | --- |
| **Shared identity resolver** | Features 2, 5, 6 and 7 all need "messy input -> catalog item". Building it per feature yields four inconsistent matchers. | Phase 0 |
| **Follow primitive** | Feature 7 is the glue for 1, 3, 4, 5, 6. Building it last forces rework of each earlier feature's "follow" button. | Phase 0 |
| **Relationship store with provenance and confidence** | Feature 1's continuation mapping is free text and often empty; the ledger forbids silent inference. | Phase 0/1 |
| **Server-side URL fetching safety** | Share-by-link means SeerrNG fetches user-supplied URLs: SSRF, redirects, size, timeouts. | Phase 0 |
| **Image privacy and vision backend** | Screenshot/cover recognition needs OCR or a vision model. Images must not be persisted, and external vision must be opt-in. | Phase 3 |
| **iOS share path** | Web Share Target works on Android Chrome installs only. iOS needs a Shortcut or native extension. | Phase 3 |
| **Quotas, permissions, approval** | Variant, edition, and expansion requests must obey the existing quota and auto-approve rules, and be visible in request history. | Every phase |
| **Per-user vs global preferences** | Narrator, translation, and region choices differ per person; the companions mostly hold one global policy. | Phases 2, 4, 5 |
| **Rate limits and caches** | AniList, MangaUpdates, RanobeDB, IGDB each have limits; relationship data should be cached with TTLs and negative caching. | Phase 1 |
| **Migrations on SQLite and Postgres** | Every new entity needs both. | Every phase |
| **i18n, a11y, narrow layout** | Cards, pickers and comparison tables must pass the repo's UI standard. | Every phase |
| **OpenAPI + contract bump** | `seerr-api.yml` and the contract JSON are tested; both change. | Every phase |
| **Telemetry for quality** | "Recommendation quality needs evaluation" has no measurement path. Add opt-in match-outcome counters (matched / corrected / abandoned). | Phase 3, 6 |

## Phase 0 - Shared foundations (SeerrNG only)

### 0.1 Identity resolver

Single service turning an input into ranked candidates with a confidence level.

- `server/lib/resolve/index.ts` - `resolve(input, hints) -> Candidate[]`.
- `server/lib/resolve/parsers/` - one parser per input kind: `url` (Steam,
  Letterboxd, IMDb, TMDB, Goodreads/Hardcover/bookstore, MusicBrainz, AniList),
  `isbn`, `text-list`, later `image`.
- `server/lib/resolve/fetchSafe.ts` - the only place user URLs are fetched:
  scheme allowlist, private-range block, redirect cap, 2 MB cap, 5 s timeout.
  Reuse `server/utils/customProxyAgent`.
- Reuses existing `bookIdentifierResolver.ts`, `externalIds.ts`, `search.ts`,
  `slskdn.ts` (SongID). It orchestrates; it does not duplicate them.
- Candidate carries `confidence: 'high'|'moderate'|'low'`, `source`, and the
  evidence string shown to the user ("matched ISBN 978...").

### 0.2 Follow primitive

- `server/entity/Follow.ts` - `{ user, kind, subject, conditions(json), notify, autoRequest, lastSeen }`.
  `kind`: `narrator | series-language | edition | expansion | artist-release-type | patch-project | author | franchise`.
- `server/lib/follow/index.ts` - evaluation job; emits `FollowEvent` rows with a
  machine-readable `reasonKey` + values (same pattern as `AssociationReasonKey`).
- `server/entity/FollowEvent.ts`, migrations for SQLite and Postgres.
- Hooks into the existing `MediaAvailabilitySubscription` and
  `server/lib/notifications/intents.ts` rather than a parallel notification path.
- `server/routes/follow.ts` + OpenAPI; `src/pages/following.tsx` and
  `src/components/Following/` (the "personal news" page).
- Auto-request is off by default and runs through the normal request path so
  quotas and approval apply.

### 0.3 Relationship store

- `server/entity/MediaRelation.ts` - `{ fromType, fromId, toType, toId, relation, evidence, confidence, source, verifiedBy? }`.
- Admin override via the existing `DiscoveryCuratedIdentityMapping` pattern, so a
  wrong or missing mapping can be corrected once for everyone.

## Phase 1 - Anime to source continuation (flagship, feature 1)

User experience: on an anime page, **Continue with the manga or novels**. Pick
the season finished. See the source series, where the season ends when known,
the volume holding the continuation in the user's language, and three actions:
**Request this volume**, **Start from the beginning**, **Follow future
translated volumes**. When the endpoint is unknown, show the source series and
say the continuation point is not documented.

SeerrNG:
- `server/api/anilist/index.ts:47-110` - extend `MEDIA_FIELDS`/`MEDIA_QUERY`
  with `relations { edges { relationType node { id idMal type format title coverImage } } }`.
  Keep the list queries lean; add a separate `MEDIA_RELATIONS_QUERY` so paged
  lists do not pay for it. Add types to `server/api/anilist/interfaces.ts`.
- `server/api/mangaupdates/index.ts` (new) - series lookup by title/MAL id;
  parse the free-text continuation field into `{volume, chapter}` only when it
  matches a strict pattern; otherwise return raw text and `confidence: 'low'`.
- `server/api/ranobedb/index.ts` (new) - series by AniList/MAL id, books by
  language and edition.
- `server/lib/continuation/index.ts` - joins the three, writes `MediaRelation`
  rows, caches with negative caching, respects AniList rate limits.
- `server/routes/series.ts` (anime route) or new `server/routes/continuation.ts`
  with OpenAPI.
- UI: `src/components/Continuation/` (card + season picker), mounted from the
  anime branch of `TvDetails`/`MediaDetails`. Request buttons reuse
  `RequestModal` for books and comics.
- "Follow future translated volumes" creates a `series-language` Follow.

ChaptarrNG: expose AniList and MAL ids in the RanobeDB series resource
(`MetadataSource/RanobeDb/RanobeDbResources.cs` series type) and surface them on
`SeriesResource.cs`; advertise a capability flag in its contract.

Comics: the configured comic service handles manga; no change except the
volume-targeted request, which already exists via the comic catalog index
(`server/lib/comicCatalogIndex.ts`).

Tests: fixtures recorded from the Frieren (MangaUpdates 66296374554) and Irina
(RanobeDB 6319) responses; a parser test asserting "volume 7, chapter 60" yields
"continue in volume 7 from chapter 61" and that empty or prose fields yield
low-confidence, not a guess.

## Phase 2 - Narration and edition comparison (feature 3, plus music)

User experience: edition cards (narrator(s), full-cast vs solo, abridged,
duration, language, year, cover) with choices **Only this version**, **Either
of these**, **Keep alongside the existing version**. Series page gains
**Collect this series with the same narrator**, showing covered, missing, and
other-performance volumes before the user commits.

SeerrNG:
- `server/api/servarr/readarr.ts:2155-2180` (`getRequestedEditionUpdate`) -
  currently selects one monitored edition. Add a path calling Chaptarr's
  wanted-edition endpoint (`AddWantedEditionRequest`) gated on capability.
- `server/interfaces/api/requestInterfaces.ts` and `server/entity/MediaRequest.ts` -
  add `editionPolicy: 'only'|'either'|'alongside'` and `variantKey`.
  Migration for both databases.
- `server/lib/editionCompare/index.ts` - normalises editions to a common card
  model; unknown fields stay unknown.
- UI: `src/components/BookDetails/` edition panel and
  `src/components/BookSeriesDetails/` narrator-series view.
- Per-user narrator preference stored in `UserSettings`.

ChaptarrNG:
- `Chaptarr.Api.V1/Series/SeriesController.cs:70-180` - narrator analysis
  currently examines monitored editions only. Add a catalog-wide mode returning
  per-volume available narrators.
- Translator-specific ebook variants need new edition metadata; **not in this
  phase**, tracked as follow-up and clearly labelled unavailable in the UI.

Music: `slskdN` `Wishlist/WishlistService.cs` edition markers feed a
`release-variants` read endpoint; SeerrNG `MusicDetails` gets a release picker
(standard/deluxe/remaster) with track-list differences from MusicBrainz
release-group data. Claim only what evidence supports; do not label a rip
"this remaster" from a filename.

BookshelfNG: mirror the wanted-edition capability if its API shares the
Readarr shape; otherwise the UI hides the option.

## Phase 3 - Share to request (feature 2)

User experience: SeerrNG appears in the phone Share menu; a universal
paste/drop area on `/identify` (extend `src/pages/identify.tsx` and
`src/components/Soulseek/SongIdentify.tsx`). Multiple recognised titles appear
as independently selectable cards; ambiguous ones show candidates with cover,
creator, year. Format switching at the point of discovery ("request the
audiobook of this paperback").

SeerrNG:
- `public/site.webmanifest` - add `share_target` (POST multipart, so images
  work) for installed PWAs on Android.
- `src/pages/api/share` equivalent route in `server/routes/share.ts`; uploads
  are processed in memory, never written to disk, with size/type limits.
- `server/lib/resolve/parsers/image.ts` - ISBN/barcode first (no model needed),
  then OCR, then optional vision model behind an admin setting that is off by
  default and names the external provider before it is enabled.
- `android/app/src/main/AndroidManifest.xml:17-25` - add `SEND` intent filters
  (`text/plain`, `image/*`) to `MainActivity` and forward to the web route.
- iOS: documented Shortcut recipe in `docs/using-seerr/`; no native extension
  in this plan.
- Browser: separate repository decision (see open question 4) for extending
  Overseerr Assistant; SeerrNG exposes a stable `/api/v1/resolve` for it.

## Phase 4 - Translations and ROM hacks (feature 5)

User experience: on a game, choose an English fan translation, see project,
version, completeness, and differences; keep the original alongside; follow a
project and hear about new versions. Discovery shelves for completed
translations and notable hacks per owned system.

ROMarrNG (`romarr/collections.py:174-228` already holds translation policy):
- New `romarr/patch_catalog.py` - projects, versions, base-ROM requirements
  (hash-pinned via `dat_catalog.py`), completeness status, patch format.
- Patch preparation using the exact base revision; refuse when the base is
  absent or mismatched rather than producing a wrong ROM.
- Capability + read endpoints in `romarr/app.py`; contract fixtures.

SeerrNG: `server/api/software/romarrng.ts` client methods; a Games/ROM detail
panel; `patch-project` Follow kind. A filename containing "translation" never
counts as complete; completeness comes from the catalog only.

Coverage honesty: start with a curated catalog and say so in the UI.

## Phase 5 - Game edition and expansion selection (feature 4)

User experience: compare editions in plain terms (which expansions, which are
cosmetic, what the library already has, what the request adds). Primary action:
**Get the missing content I selected**. Unknown edition contents are shown as
unknown.

QuestarrNG:
- `server/igdb.ts:446-463` - stop collapsing editions in the integration
  projection; keep base-game behaviour for the main UI.
- `shared/schema.ts:214-224` - promote expansion/DLC from display-only to
  independently wanted items.
- `server/routes/integration.ts:171-220` - project editions, expansions,
  included-feature values.
- Matching acquisition: release matching against selected content only.

SeerrNG: comparison UI in `src/components/GameLibrary/`; request payload carries
selected content ids; `expansion` Follow kind.

## Phase 6 - Steerable discovery (feature 6)

Three independent slices, shippable in any order:

- **Hardcover Vibes**: read existing personal/public feeds through the existing
  discovery-integration layer (`server/lib/discoveryIntegrations/`,
  `server/entity/ExternalRequestList.ts`). Series-position filtering applied in
  SeerrNG. Custom Vibe creation shown only for Supporter accounts; detect and
  explain rather than fail.
- **Saved game searches**: `server/entity/SavedDiscovery.ts`, themes/modes/
  perspectives/language from an extended QuestarrNG projection; "why this
  matched" built from attributes; new-match notifications via Follow.
- **Collector taste feed**: `server/api/slskdn.ts` gains the taste-recommendation
  and release-radar calls; a "Shared by collectors you follow" shelf with the
  reason shown. Gated on slskdN capability.

## Phase 7 - Following and personal news (feature 7)

Completes the UI promised by Phase 0.2: per-source adapters feeding
`FollowEvent` (narrators from Chaptarr, series editions from Phase 1, expansions
from Phase 5, patch versions from Phase 4, artist releases from slskdN radar).
Advance-announcement coverage is limited by what each catalog publishes; say
"announced" only when a source says so. Reconcile with
`server/lib/releaseCalendar/` so followed items also appear on `/calendar`.

## Phase 8 - Franchise page (revives the deferred ledger item)

Builds on `MediaRelation` and the Associations module. Extend
`server/lib/associations/types.ts` with `game` and `comic` media types and an
`adaptation-of | sequel | side-story | soundtrack` edge type; add
`src/pages/franchise/[id].tsx`. Ledger questions (membership sourcing, naming,
difference from recommendations) must be answered with the user before this
phase starts.

## Order and release plan

| Order | Phase | Release | Depends on |
| --- | --- | --- | --- |
| 1 | 0 Foundations | one minor | - |
| 2 | 2 Narration/edition (fastest value; backend exists) | one minor | 0 |
| 3 | 1 Anime continuation | one minor | 0, ChaptarrNG ids |
| 4 | 3 Share to request | one minor | 0.1 |
| 5 | 4 ROM translations | one minor | 0.2, ROMarrNG |
| 6 | 5 Game editions | one minor | QuestarrNG |
| 7 | 6 Steerable discovery | per slice | 0.2 |
| 8 | 7 Personal news | one minor | all adapters |
| 9 | 8 Franchise | one minor | 0.3 |

The recommendation ranks anime continuation as the flagship and narration as
the quickest win. This order ships the quick win first and the flagship second
because both depend on Phase 0 anyway; swap them if you want the flagship
visible first.

## Verification per phase

Targeted unit and contract tests, OpenAPI test, changed-file ESLint and
Prettier, both-database migration check, narrow-layout and keyboard review per
`ui-style-standard.md`, release-note fragment validated through
`parseReleaseNote`. Companion repos run their own suites. Nothing is called
done without a real run against a disposable local instance.

## Confidence

- Phase 2 and Phase 6 (slskdN, Hardcover read): high; the backends exist.
- Phase 1: high for showing the source series; moderate for exact continuation.
- Phase 3: high for links/ISBN/lists; moderate for arbitrary screenshots.
- Phase 4 and 5: moderate; they depend on new companion catalogs and metadata
  that is incomplete for many titles.
- Sibling-repo line references: unknown until re-read; treated as pointers only.

## Open decisions

1. Scope: full nine-phase build, or a first release of Phase 0 plus Phases 1
   and 2.
2. Phase order: quick win first (as written) or flagship first.
3. Vision/OCR: local-only (Tesseract, ISBN/barcode), or allow an opt-in external
   vision provider.
4. Browser extension: extend Overseerr Assistant upstream, or ship a separate
   SeerrNG extension.
5. Companion changes: confirm the companions may receive API additions in the
   same release train, with SeerrNG degrading gracefully on older versions.


## Build record

Built in a single pass, not in phases, on 2026-10-18/19. Decisions that differ from the plan:

- **Browser extension:** a separate, standalone repository, `seerrng-companion`, not an extension of Overseerr Assistant.
- **Image recognition:** local Tesseract OCR plus an opt-in vision provider (Anthropic or any OpenAI-compatible server, including local Ollama/LM Studio) behind an explicit consent setting. The planned opt-in outcome counters were dropped; nothing is recorded about matches.
- **Companion API additions:**
  - ChaptarrNG: `GET /book/{id}/editions/catalog`, `GET /series/narrators/matrix`, three capability flags. The existing wanted-edition endpoint is reused for "alongside".
  - BookshelfNG: read-only `editions/catalog` and the `editionCatalog` flag (a second performance cannot be tracked there).
  - QuestarrNG: `catalog/games/{id}/editions`, `catalog/discover`, `selection` on requests, a wanted-content pass in the auto-search job, ledger column `selection`.
  - ROMarrNG: `patches/search`, `patches/projects/{id}`, `selection` on requests, IPS/UPS/BPS preparation with checksum verification. No catalogue data is bundled.
  - slskdN: `GET taste-recommendations/capabilities`. Release comparison uses MusicBrainz; the chosen release reaches slskdN through the Lidarr monitored release it already syncs, so no variants endpoint was added.
- **AniList ids in ChaptarrNG:** not added. SeerrNG reads AniList and MAL ids from RanobeDB directly.
- **MangaUpdates** documents the anime range per season (`Vol 7, Chap 61 (S2)`), so season boundaries are read per season rather than only for the latest one.
- **Auto-request** from Follow is limited to books; other media need choices a background job must not guess.
- **iOS:** documented Shortcut recipe only; no native share extension.
