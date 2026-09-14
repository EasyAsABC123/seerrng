# ADR 0005: Distinguish library membership from series catalog requests

Status: accepted for local trial. Refines catalog identity resolution in ADR 0003.

## Evidence

Chaptarr native series 170 (gr:45262) lists only Rogues. Its ebook counterpart
171 does likewise. SeerrNG correctly mapped that member, but a library-first
search result and Request Series label presented the subset as the intended
series. The user expected the Patrick Rothfuss novels and deliberately selected
both formats; format selection was not a bug.

The configured backend's catalog hc:988 lists The Name of the Wind, The Wise
Man's Fear and The Doors of Stone. The first novel's ISBN evidence includes a
boxed set and a different novella; the second includes split-volume records.
The prior rule blocked any multiple-work match, making the primary novels
unrequestable even with additional corroborating metadata.

## Decision

Prioritize catalog search results. Native library pages explicitly identify
library subsets and requests as listed library books, and expose catalog
matches separately. Do not delete native membership or infer cross-provider
series equivalence from a shared title. Opening a catalog match is an explicit
reader choice. No Chaptarr data or monitoring changes are needed.

For complete ISBN-only evidence with multiple candidates, accept a work only
when exactly one candidate has the complete normalized title, and its author
list explicitly includes the backend's named author. Other candidates must
have nonempty differing titles. Normalize case, Unicode typography and
whitespace only; do not drop subtitles, split-volume markers or use fuzzy
matching. Never select by popularity or number of matching ISBNs.

Keep all original candidates for cross-book ownership collision checks.
Missing/incomplete provider evidence, unavailable ISBN batches, explicit
work-ID conflicts, duplicate full titles, or absent author agreement remain
blocked. No ISBN-free title discovery is introduced. Request creation still
uses verified Open Library identities and existing per-format routing,
approval, quota and backend checks.

Request dialogs list titles that could not be verified instead of silently
omitting them. Library-subset dialogs state their limited scope. Both-format
requests remain an explicit user selection.

## Validation and limits

Regression fixtures use the observed Kingkiller work IDs and ISBN conflicts.
Negative tests cover absent/wrong authors, duplicate full titles, incomplete
identifiers, explicit-ID conflicts and title-only false matches. Browser
validation must open the real catalog preview, verify the primary novels and
Patrick Rothfuss in the modal, choose both formats, and inspect a simulated
submission; no real books are requested by that check. Deployment must then
verify the same catalog API identities on the running build.

Metadata may still be wrong or incomplete, and a catalog preview need not be a
complete bibliography. The Doors of Stone entry is retained as supplied by the
provider; this does not establish publication or download availability.
