---
title: Troubleshooting cross-media features
description: Fixes for share, continuation, edition, patch, book recommendation, and Following problems.
sidebar_position: 16
---

# Troubleshooting cross-media features

**The Share page says it cannot read images.** Install `tesseract` on the SeerrNG host (the official image does not include it), or choose a vision provider under **Settings → Services → Share and Image Recognition**. Photos of barcodes are read in the browser when the browser supports barcode detection.

**A shared link finds nothing.** Only public pages are read, with a size limit and a short timeout. Sites that need a login, or that block automated readers, are reported as unreadable; paste the title instead. IMDb, TMDB, and Letterboxd links resolve even when the page cannot be read.

**Anime continuation shows no source.** AniList must list a manga or novel as the anime's source. When it does, but the end of the season is "not documented", MangaUpdates has no entry for that season; the series is still shown.

**The volume is shown as approximate.** MangaUpdates states where a season ends but not where the next begins. SeerrNG shows the next chapter and says the volume is not documented rather than guessing.

**Edition cards show "Not provided".** The catalog does not state it. ChaptarrNG and BookshelfNG show what their metadata contains.

**"Keep alongside" is missing.** It needs ChaptarrNG with `wantedEditionVariants`, and an existing version of the book in the library. Update ChaptarrNG.

**Game editions or Game Finder say they need QuestarrNG.** Connect QuestarrNG in **Settings → Services** and use a version whose handshake reports `editions` and `discover`.

**Translations & Hacks is empty.** ROMarrNG ships no catalogue. Add JSON files to its `patch-catalog.d` folder or set a catalogue URL (see ROMarrNG's *patch catalogue* guide).

**A patch request fails with `BASE_MISMATCH`.** The base game in the library is not the dump the patch was made for. Request the base game in the right region or revision first.

**Book recommendations ask for a token.** Add a Hardcover list with an API token that can read recommendation feeds. Creating a personalized feed needs a Hardcover Supporter account.

**Collector Picks is empty.** slskdN needs social federation enabled and trusted collectors followed.

**Following shows nothing new.** The first check only records a baseline. Run **Followed Interests Sync** from **Settings → Jobs & Cache** and check the log for the source that failed.
