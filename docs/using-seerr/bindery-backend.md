---
title: Bindery Backend
description: Connect Bindery to send approved ebook and audiobook requests and scan library availability.
sidebar_position: 22
---

# Bindery Backend

Bindery is an optional book acquisition service for ebooks and audiobooks. Add
it from **Settings → Services → Audiobooks & Books → Add Bindery Server**. Use
the host, port, URL base, SSL setting, and API key for your Bindery instance.
The default Bindery port is `8787`; leave URL Base blank unless Bindery is
served under a path. Keep the API key in the SeerrNG service form.

Choose **Ebook**, **Audiobook**, or **Ebooks and audiobooks**. A connection set
to both formats can be the default for both, so an approved request for both
formats is sent to Bindery once with `mediaType: both`. If you use separate
Bindery instances for the formats, add one service entry for each and mark one
default for each format. Enable **Scan library availability** to include
Bindery's imported books in SeerrNG's availability checks.

## Request handling

SeerrNG keeps discovery and book metadata in its configured book catalog. On
approval, it resolves the title to the identifier expected by Bindery's
configured primary metadata provider, then asks Bindery to add and search for
the requested format. Bindery handles indexer search, downloads, imports, and
its own acquisition settings. SeerrNG records the service destination and
request state, and scans Bindery's imported ebook and audiobook records to
update availability. Bindery's API uses `X-Api-Key` authentication and exposes
separate endpoints for adding books, looking up metadata, and listing imported
library records; see the [Bindery API reference](https://github.com/vavallee/bindery/blob/main/docs/API.md).

For metadata matching, provide a supported identifier in the SeerrNG book
record when available: a provider ID for Bindery's primary provider or an ISBN.
When neither exists, SeerrNG can use Bindery's book search and accepts only an
exact title match with a matching author when available. If it cannot identify
the same book safely, the request fails with a diagnostic error instead of
adding a different title.

SeerrNG does not send Readarr or Bookshelf profiles, root folders, tags,
edition choices, or manual queue operations to Bindery. Configure acquisition
defaults inside Bindery. An edition selected in SeerrNG helps identify the
requested book, but Bindery's add endpoint accepts the provider book identity
and requested media format rather than a specific edition. SeerrNG does not
show Bindery's queue or manage Bindery files.

## Request ownership

Current Bindery releases may not advertise support for requester-owned
requests. In that case, SeerrNG adds the approved book using the configured API
key, so Bindery records the service account as the owner. The connection test
shows which behavior the connected version supports.

If Bindery advertises the `requestsForUser` capability in `/system/status`,
SeerrNG creates a Bindery request for the matching user. The username or email
must match exactly and identify one Bindery account; an absent or ambiguous
match stops dispatch rather than silently assigning the book to another user.
Enable Bindery's per-user auto-approval if those SeerrNG-approved requests
should start acquisition immediately. See Bindery's [multi-user guide](https://github.com/vavallee/bindery/blob/main/docs/multi-user.md).

## Availability and request lifecycle

SeerrNG scans imported records separately for ebooks and audiobooks, then
matches provider IDs and ISBNs to SeerrNG's book records. Scanning is
read-only: it does not ask Bindery to search or download anything. Bindery
remains responsible for acquisition and delivery; SeerrNG remains responsible
for its request approval and user-facing availability status. Cancelling a
SeerrNG request does not remove or cancel a book that Bindery is already
acquiring.

Bindery's API also exposes administration, queue, file, OPDS, backup, and
metadata-management features. SeerrNG only uses the operations needed to test
the connection, resolve and add approved books, map requester accounts when
the server advertises that capability, and scan library availability.
