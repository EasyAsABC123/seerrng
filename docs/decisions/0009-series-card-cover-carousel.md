# ADR 0009: Preview backend books on series cards

- Date: 2026-09-16
- Status: accepted for local trial
- Confidence: high for scoped artwork access; provider artwork availability varies

Show a small horizontal carousel inside the existing shared series result card.
Use backend member metadata without Open Library identity resolution, book lookup,
ISBN enrichment, imports or monitoring. Load a preview only when the card enters
the viewport, cap it at twenty ordered members, and reuse cached native metadata.
Missing or unsupported artwork does not prevent opening the series.

Native targets resolve through the stored series/server scope. Catalog targets
use the configured server, exact endpoint scope and provider identity. Authenticated
image reads select a member from that metadata; clients cannot supply image paths.
Only backend-owned MediaCover and MediaCoverProxy paths are accepted. Images stay
on that server origin, without redirects, with a five-megabyte limit and restricted
raster MIME types. Neither API credentials nor backend image URLs reach the browser.
Artwork has a separate rate budget so thumbnails do not consume series action
limits. No extra metadata key is required.

Live validation found that Chaptarr's UI artwork route requires a browser session.
Use its authenticated API artwork route instead, added with this trial. That route
reuses Chaptarr's existing registered-image proxy and missing-image policies; it
does not relax UI authentication. Older backends without this API show icons.

Use touch scrolling, previous/next controls, keyboard arrows, visible focus and
reduced-motion preferences. Covers open the series rather than inventing a book
identity. Keep the stretched card link and independent format links, with carousel
controls above the stretched link. Title/icon placeholders handle absent covers.
