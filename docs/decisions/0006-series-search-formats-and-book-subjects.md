# Series search formats and book keyword coverage

Status: accepted for the local contribution trial.

## Problem

Ebook and audiobook configurations returned separate cards for the same catalog
series. Kingkiller returned eight rows across two configurations, including two
copies each of three Hardcover catalogs and one Goodreads library series.

Book search was independent but appeared broken alongside the series cards.
The live request hit the global five-second deadline. Its intended provider
message was masked by the generic internal-error handler. Even a successful
request searched and locally matched only title and author, excluding novels
whose series name was recorded in catalog subjects.

## Decision

Group search display results by an explicit namespaced global series ID (`hc:`
or `gr:`). Keep every original backend URL, format, source, and count as a
variant. Prefer catalog navigation when a library record has that same explicit
identity. Do not add counts across formats or claim that different library
inventories contain the same number of books.

Never infer identity from a title, numeric native ID, or overlapping book count.
The main Kingkiller catalog, a separate one-book catalog, split editions, and
the Goodreads library subset remain different provider records. A title-only
merge could redirect a request to the wrong books. Backend configuration and
format filtering continue to apply before any lookup. Requests and monitoring
continue through the selected backend's existing routes.

Book keywords search title, author, and catalog subject fields and retain the
same all-keywords relevance check across those fields. This allows a series
name to find individual novels without accepting unrelated publisher-only
matches. Book-only global search gets a bounded fifteen-second provider budget;
mixed-media search retains its five-second deadline. A known book-provider
failure returns a static public retry message directly, without exposing a
provider exception or weakening the general error sanitizer.

## Evidence and limits

Tests cover preserved per-format routes, same-title/different-ID separation,
catalog/library preference only with exact identity, differing inventory counts,
format filtering, subject-based novel discovery, a response later than five
seconds, and safe provider failure messages. Live Open Library queries returned
the expected Rothfuss novels through their Kingkiller subjects.

No new provider credential, database migration, automatic acquisition, monitoring
scheduler, metadata write, or upstream PR is introduced. Different provider IDs
can only be merged in a future change if the provider supplies reliable identity
crosswalks or equivalent evidence.
