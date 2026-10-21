# Book series from library servers

A book already linked to a configured Readarr-compatible server can show its
series name and position. Select the link to open the series in SeerrNG. Ebook
and audiobook links remain separate. No new API token or metadata account is
required in SeerrNG.

The page displays the **server's known library members**, not a complete catalog
of every published or announced title. Readarr and Bookshelf series resources
are supported, as are Chaptarr's native resources. A server without a compatible
series endpoint simply supplies no series links. Audiobookshelf library sync
alone does not supply these Readarr-style relationships. Book-details links still require a linked library-manager record. Direct series
search, described below, does not require a SeerrNG book binding.

**Request Series** opens the existing selection dialog. Requests keep the usual
format selection, missing-format checks, permissions, approvals, quotas, and
server routing. Existing primary/extra classifications are respected; unknown
classification is disclosed and included by default. An explicit extras checkbox
includes entries classified as extras. A book needs a canonical library identity
or an unambiguous exact ISBN-to-Open-Library match before it can be requested.
Conflicting identities remain visible without request actions.

For request managers, Chaptarr series pages also offer **Manage Series in
Chaptarr** (using the configured server name and external URL). That opens the
backend's native series page. Its available controls depend on the installed
Chaptarr version. SeerrNG does not send monitoring mutations through this link.

The backend owns monitoring, searches, downloads, import, retries, and timing.
This feature does not create a future-series watch. Configure a supported series
import list in the backend for discovery of future entries. It does not enable
all future books by an author.

Native reads are cached for five minutes. Pages contain up to 500 members, with
an explicit truncation notice; only displayed verified entries enter the dialog.
Native book reads run in batches of five. ISBN lookups run in batches of 25;
unavailable or incomplete evidence produces a retryable error. Library-manager
format labels describe managed/requested state, not verified download completion.

Local page IDs are scoped to a configured server, endpoint, and format. Changing
that endpoint or format invalidates old pages. Changing its name or API key does
not. Replacing a backend database at the same endpoint can reuse native IDs;
operators should remove stale local mappings when replacing the database. Series
membership refresh remains the backend's responsibility.

See [the decision record](decisions/0001-backend-book-series.md) and
[validation evidence](book-series-evidence.md) for contribution scope and limits.

## Search by series name

Choose **Book Series** on the Search page, or open `/book-series`. Enter a series
name and optionally select books or audiobooks. The search includes series known
to configured compatible book servers, including those without a saved SeerrNG
book match. Results identify the server, format and whether they are a library
series or a catalog preview.

Library results open the existing series page and its verified request selection.
Chaptarr can also supply catalog results using its own configured metadata
provider. Those results open a catalog preview with **Request Series** for users allowed
to request books. Only members with a verified Open Library identity enter the
normal selection dialog; conflicting, absent or unavailable matches remain
visible. Requests keep normal approval, quota, format and backend-routing rules.
Both library and catalog audiobook series default to audiobook requests. Reading
a preview does not add books, request them, or enable monitoring. Request managers
can also use **Open in Chaptarr** for optional native management. No additional provider
key is required in SeerrNG; Chaptarr catalog search needs its existing provider
configuration. Readarr and Bookshelf provide native library search only.

Search scans at most 250 authors per server and displays up to 100 results per
source/server. An incomplete-results notice appears when a limit is reached or a
source is unavailable. Other available results remain usable.

Catalog identity resolution uses exact backend work IDs or checksum-valid edition
ISBNs, never a title guess. Chaptarr's optional `includeBookIdentifiers=true`
series extension avoids an individual metadata lookup when it returns complete
edition evidence; older versions use exact native book lookup. Upgrading the
backend can therefore improve resolution without adding a provider key in
SeerrNG. Each preview checks up to 100 distinct members and 2,500 ISBNs. Incomplete
identifier sets fail closed. See [ADR 0003](decisions/0003-catalog-series-requests.md).
