# Artwork reuse: browser evidence

Source commit: `bfe4d19fa25878861067d2da1733efe236c31038`  
Captured: 2026-09-09T21:17:38.647Z  
Browser: Chromium 152.0.7977.82

These are recordings and screenshots of the actual locally running SeerrNG production build. Catalog metadata and artwork are deterministic fixtures served by an HTTP reverse proxy. They are **not production catalog content**. The artwork labels show the actual source image width; they are part of the fixture images, not added UI overlays.

Authentication finished before recording. The recorded contexts used the authenticated session in memory. Native browser HTTP caching remained enabled, and the service worker controlled both recorded scenarios.

## Recordings

| Recording | Preview | Duration | Viewport | Result |
| --- | --- | --- | --- | --- |
| [All eight media types](mobile-all-media.mp4) | [GIF](mobile-all-media.gif) | 20.64s | 390 × 844, DPR 2 | Movie, series, book, audiobook, album, collection, artist, and person: card → detail → back reuses the same artwork URL with zero additional image-origin requests or bytes. |
| [Poster resolution upgrade](desktop-poster-upgrade.mp4) | [GIF](desktop-poster-upgrade.gif) | 8.96s | 1440 × 900, DPR 3 | A 208-CSS-pixel poster keeps the loaded 342-pixel source visible during a 3.3-second delay, then switches to 780 pixels with exactly one image-origin request (49,218 body bytes). Back navigation transfers zero additional artwork bytes. |

Both MP4 files use H.264, yuv420p, and fast-start metadata. GIFs are smaller previews; MP4s retain the full viewport dimensions.

## Screenshots

- [Media grid](01-media-grid.png): all eight media types, using the app's existing always-visible card-title setting.
- [Mobile movie](02-mobile-movie-reuse.png): the 128-CSS-pixel detail poster retains its downloaded 342-pixel source at DPR 2.
- [Mobile audiobook](03-mobile-audiobook-reuse.png): the audiobook edition cover keeps its exact provider URL, including its edition query.
- [Desktop before upgrade](04-desktop-before-upgrade.png): the existing 342-pixel poster remains visible while the larger image loads.
- [Desktop after upgrade](05-desktop-after-upgrade.png): the decoded 780-pixel poster replaces it without changing layout.

## Assertions

[assertions.json](assertions.json) contains source URLs, intrinsic/rendered dimensions, origin request/body-byte counts, and browser resource timings captured alongside the recordings. All eight reuse cases and the delayed upgrade passed with zero application runtime errors and zero proxy errors. [media-info.json](media-info.json) contains video codec, dimensions, duration, and file sizes.

Image-origin counters establish whether bytes were downloaded. Browser resource timing can report `transferSize: 0` for service-worker responses even when the worker fetched bytes, so those entries alone are not used to claim reuse.

## Capture scripts

[capture.mjs](capture.mjs) reproduces the fixture proxy, screenshots, raw recordings, and assertions against the isolated app on port 5156. Set `EVIDENCE_EMAIL`, `EVIDENCE_PASSWORD`, and `EVIDENCE_COMMIT` for that local test instance. The supplied script expects the repository at `/tmp/seerrng-artwork-reuse`, Playwright at `/tmp/seerrng-tools`, Chromium at `/usr/bin/chromium`, and Playwright-compatible FFmpeg under `PLAYWRIGHT_BROWSERS_PATH`. [encode.py](encode.py) trims the authenticated recordings and creates the MP4/GIF files with system FFmpeg. Raw recordings and extracted inspection frames are local working files, excluded from this published evidence directory.

## Additional verification

The complete [navigation matrix](navigation-matrix.json) passed on this source commit with service workers both enabled and blocked: 16 reuse cases, two resolution upgrades, and two cold-entry cases. See [verification.md](verification.md) for automated checks and the full-suite environment note.
