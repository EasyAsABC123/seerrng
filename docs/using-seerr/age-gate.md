---
title: Age gate
description: Flag family accounts as restricted so they never see Adult or mature content.
sidebar_position: 27
---

# Age gate

The age gate hides mature content from accounts you flag as restricted, for
example children sharing your instance. It is enforced on the server, so a
restricted account cannot reach hidden content by editing a URL or calling the
API directly.

## What restricted accounts lose

- The **Adult** category: navigation, discovery, scene pages, and requests.
- Movies and series rated above your ceiling (defaults: PG-13 and TV-14),
  including in Discover, search, recommendations, and request creation.
- Any title the metadata provider flags as adult or explicit, and titles in any
  category (music, books, comics, magazines) whose genres, tags, or subjects
  name erotica, hentai, pornography, or similar terms.
- Existing Adult requests in Request Status.

Titles without rating or tag metadata are allowed. Filtering is best-effort and
depends on what providers return.

## Set it up

1. Open **Settings → Media Categories → Age Gate**. Pick the highest movie and
   series rating restricted accounts may see and the country whose ratings are
   used.
2. Flag accounts under **Users → (user) → Permissions → Age gate**:
   **Restricted** hides content, **Unrestricted** shows it, and **Use instance
   default** follows the setting below.
3. Optionally enable **Restrict accounts by default** so new and unflagged
   accounts are restricted. Administrators are exempt from the default.

When **Adult** is enabled, Media Categories shows a warning: anyone granted
Request Adult can see what you browse and request, which matters if you share
the instance with family or publish it through a reverse proxy.

## Boundaries

- Ratings and tags come from TMDB and other providers; unrated or untagged
  items cannot be classified.
- Restricted accounts can still request titles outside the filters through
  integrations that do not go through the SeerrNG API.
