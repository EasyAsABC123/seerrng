# Branch and upstream triage, 2026-10-20

SeerrNG is a fork of Seerr maintained by snapetech; "upstream" below means the
Seerr project, whose attribution is recorded in
[NOTICE.md](../../NOTICE.md).

This records what was merged, ported, archived or discarded when every open
branch was reconciled with `main`. Re-run the method below before the next
forward integration.

## Method

For each unmerged remote branch, count what fraction of the lines it adds
already exist in the same files on `main` (ignoring lines shorter than 12
characters). A branch that is mostly present was integrated by hand during the
forward merges (the history is not an ancestor, so `git branch --merged`
cannot see it). Branches with low overlap were read individually.

## Results

| Source | Branches | Outcome |
| --- | --- | --- |
| `origin`, `gitlab` | 0 unmerged, 0 open PRs | Nothing to merge. |
| `pr-author/*` (contributor fork) | 48 | 46 are 85-100% already in `main` (download recovery, discover cache, image proxy tiers, pull-to-refresh, toast dedupe, avatar fallback, external API base path, delayed identifiers, ...). Discarded as integrated. |
| `pr-author/feat/backend-book-series` | 1 | Not integrated (36 commits, 90 files, new `BookSeries` entities and migrations). It competes with the `BookSeriesDetails` implementation already in `main` and conflicts in 19 files, including search, discover and layout code. Archived as the tag `archive/pr-author-feat-backend-book-series`; revisit only as a deliberate feature merge. |
| `pr-author/fix/chart-app-version-v3.8.0` | 1 | Obsolete; the chart `appVersion` is set at each release. |
| `upstream/*` (the upstream Seerr project) | 60 | Not ours to merge wholesale. See below. |

## Upstream `develop` since the 2026-09-23 base (24 commits)

| Commit | Change | Decision |
| --- | --- | --- |
| `53e77bf34` GHSA-8j73-j6rc-q8xh | `User.settings` leaked notification credentials through embedded users | Already fixed more strictly: embedded users are projected with `User.publicFilter()` and `toJSON()` goes through `filter()`; covered by `server/utils/entityResponse.test.ts`. |
| `9fda1c627` GHSA-xc6j-6p6h-p799 | `GET /movie/:id` and `/tv/:id` leaked other users' email/plexId and issue contents in `mediaInfo` | Already fixed more strictly: `restrictMediaRequestsForUser` projects foreign requests to availability data and `restrictMediaIssuesForUser` gates issues by permission; covered by `server/lib/mediaResponse.test.ts`. |
| `b91944320` override rules | Keep values chosen by advanced requesters | Already implemented (`requesterSelectedRootFolder ? null : ...`). |
| `68e01b98a` | Issue-comment lookups on the owning connection | Already handled by deferred notifications tied to the query runner. |
| `103976d1b`, `9a5c89fb9` | Plex watchlist concurrency and invalid-response caching | Already implemented (`mapWithConcurrency`, `isCacheablePlexWatchlistPage`). |
| `cd8aa1f0d` | Jellyfin season/episode items in the recently-added scan | Already implemented (stricter: skips items without a parent series). |
| `53e45647a` | Sort requests by creation date | Already implemented (`createdAt` with an `id` tie-break). |
| `9e2021b82` | Treat intermittent Plex PIN 404s as transient | Already handled server-side (the PIN poll route maps 404 to "not yet"). |
| `8f2eceeaa` | Decline requests when media resets to UNKNOWN | Already implemented (deferred status resets and `declineOrphanedRequests`). |
| `978f437dc` | Search in Radarr only when the movie is available | Already implemented (`isAvailable` checks). |
| `63705622e` | Minute interval for the Plex watchlist job | Already implemented. |
| `84ed3c1c0` | OpenAPI watchlist POST schema | **Cherry-picked.** |
| `31b100dde` | Savepoint collisions when completing requests | **Ported** (sequential saves). |
| Weblate, helm, CI, docs, renovate | Translations, chart and workflow bumps, contribution docs | Not applicable to this fork's catalogs and pipelines. |

Other `upstream/*` feature and fix branches (episode availability, TVDB
recovery, request failure reasons, season-number override, Plex profile
import, media-server migration, language setting, tooltip refactor, ...) are
unmerged upstream pull requests by other authors. The fork re-implements the
behaviour it wants (see `docs/fork-rationale.md`), so they are discarded
rather than merged. Upstream renovate branches are superseded by this
repository's own dependency bot.
