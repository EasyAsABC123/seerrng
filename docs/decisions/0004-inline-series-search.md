# ADR 0004: Show series where readers search for books

Status: accepted for local trial; no upstream PR published.

## Problem and evidence

The reader entered Kingkiller in both the global search bar and the Books
keyword filter. Both surfaced an Open Library collection work, while the
backend series existed in library and catalog search. A separate Book Series
filter on the global results page was insufficiently discoverable.

## Decision

Render a separate Book Series section above individual titles for global
All/Books/Audiobooks searches and Books keyword searches. Add a persistent
Search Book Series link immediately below the Books heading. Keep one Books
sidebar entry and preserve the selected format in searches and navigation.

Reuse the same authenticated backend series endpoint, result cards, state
messages and URL encoder as dedicated search. Show up to six inline results
and link to the full result page. Search already debounced route queries;
reuse SWR responses for one minute and disable focus/error retry loops. Do
not request series for empty/invalid names, disabled books, or movie/TV/music
filters. Errors in individual-title lookup do not hide series results.

Series matching uses name and format; other title filters and sorting do not
apply to this separate section. Its copy states that scope. Library/catalog
sources stay explicit and link to the existing detail or catalog-preview
flow. A collection book result does not establish series identity.

## Alternatives

Only adding a link still requires readers to learn a second search workflow.
Mixing series into book cards would blur collection works, series identities
and individual requests. Adding another sidebar entry would reverse the
requested Books navigation grouping.

## Boundaries and consequences

No new provider credentials, catalog service, automatic request, download or
monitoring responsibility is introduced. Request identity and matching guards
are unchanged. Discovery depends on backend title matching; this does not add
fuzzy aliases for spaced or plural spellings. Automatic series lookup adds a
bounded request after a keyword change and remains subject to existing
server rate limits. Provider failures are displayed with a manual retry.

## Validation

See the inline-series-search-evidence folder in the private workspace for
production-browser, real API, build, and deployment evidence. Authentication
fixtures used in browser automation are explicitly distinguished from live
API and public asset verification.
