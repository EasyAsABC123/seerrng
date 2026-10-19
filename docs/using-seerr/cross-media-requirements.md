---
title: Cross-media features and what they need
description: Which service, version, and permission each cross-media feature needs, and what happens without it.
sidebar_position: 13
---

# Cross-media features and what they need

Every cross-media feature is optional. When a service is missing or too old, the control that needs it is hidden or explains what is missing; nothing shows a blank panel or an error.

| Feature | Needs | Without it |
| --- | --- | --- |
| Share & Identify: links, ISBNs, lists | Nothing beyond a configured catalog (TMDB, Open Library, MusicBrainz, QuestarrNG for games) | Items from a missing catalog simply have no candidates |
| Share & Identify: photos | Tesseract on the host, or a vision provider in **Settings → Services** | The page explains that this server cannot read images; text and links still work |
| Share target in the Android app | The SeerrNG Android app | Paste or upload on the share page |
| Share target in the installed web app | Android Chrome, SeerrNG installed to the home screen | Paste or upload |
| Anime continuation | Nothing to install (uses AniList, MangaUpdates, RanobeDB) | Shows the source series and says where a season ends is not documented |
| Request the continuation volume | Book service (ChaptarrNG or BookshelfNG) for novels, ComicVine for manga | A search page for the title |
| Edition and narration cards | A book service; richer cards need ChaptarrNG or BookshelfNG with `editionCatalog` | The existing edition picker |
| Keep a second performance alongside | ChaptarrNG with `wantedEditionVariants` | The choice is hidden; "Only this version" and "Either of these" remain |
| Series narrator comparison and "Collect With" | ChaptarrNG with `seriesNarratorMatrix`; Collect With also needs advanced request access | The panel is not shown |
| Album release choice | MusicBrainz and a Lidarr album request | The ordinary album request |
| Game editions and selected content | QuestarrNG with `editions` and `wantedContent` | The base-game request |
| Game Finder | QuestarrNG with `discover` | An explanation that discovery needs QuestarrNG |
| Translations & Hacks | ROMarrNG with `patchCatalog` and a patch catalogue | An explanation; the original-game request still works |
| Book Vibes | A Hardcover API token with the `read:vibes` scope on your Hardcover list | An explanation of what to add |
| Collector Picks | slskdN with social federation enabled | An explanation |
| Following | Nothing | — |
| Auto-request from Following | Book follows only; your request permission and quota | The option is hidden for other kinds |

## Permissions

- Reading and using the tools needs the normal **Request** permission.
- **Collect With** a narrator needs **Advanced Request** or **Manage Requests**.
- Confirming or hiding franchise links needs **Manage Requests** or **Admin**.
- Recognition settings are **Admin** only.

## Scheduling

Followed interests are checked by the **Followed Interests Sync** job (every 30 minutes by default; change it under **Settings → Jobs & Cache**). The first check of a new follow records a baseline, so only later changes become news.

## Privacy

- Links are read by the SeerrNG server, from public addresses only, with a size limit.
- Photos are processed in memory and never stored. An external vision provider receives a photo only if an administrator enabled it and confirmed consent.
- Hardcover tokens stay on the server and are never returned by any API.
