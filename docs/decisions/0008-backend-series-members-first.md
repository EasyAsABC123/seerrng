# ADR 0008: Lead series pages with backend membership

- Date: 2026-09-15
- Status: accepted for local trial
- Confidence: high; Kingkiller membership matches all ten Chaptarr book IDs

The user identified Chaptarr's Books in Series list as the desired display. A
Library Series Subset heading and catalog suggestions preceding that list made
SeerrNG imply that another catalog was required even when the backend already
listed the desired books, including missing and unreleased titles.

Use Book Series and Books in Series for native backend pages. Put the existing
request and monitor controls before the backend's ordered list, and alternative
catalog matches after it. Describe the list's backend source without asserting
that it is a complete bibliography. Keep the existing truncation warning and
matching restrictions. Preserve every backend entry, including duplicate works,
companion books and boxed sets; presentation does not change identity or requests.

Catalog search remains available for discovering series outside the backend and
comparing alternative membership. Existing and future monitoring continues to
use the exact backend provider identity and format, with Chaptarr responsible
for discovery, scheduling and acquisition. This change introduces no API or
library mutation.
