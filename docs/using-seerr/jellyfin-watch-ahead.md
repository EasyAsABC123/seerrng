---
title: TV Episode Queue
description: Opt in to a small buffer of upcoming TV episodes requested in Sonarr as you watch in Plex, Jellyfin, or Emby.
---

# TV Episode Queue

The Episode Queue lets an approved TV request owner ask SeerrNG to keep up to
five upcoming episodes requested in Sonarr as they watch the series in Plex,
Jellyfin, or Emby. Access is **Off until a user manager approves it**. After
approval, set one default buffer in **Profile → Settings → Episode Queue** to
apply it to all existing and future TV requests. A per-show choice can override
that default.

When Episode Queue is on for a **new** TV request, the episode list changes to
a single starting episode. SeerrNG requests that episode first, then asks
Sonarr to keep the selected number of upcoming episodes requested as playback
progresses. Only one starting episode is selected, so this avoids requesting a
whole season in advance. Choose **Off for this show** to return to the normal
season or episode selection and restore the selection you had before enabling
the queue.
The queue does not guarantee a download will finish before you reach the next
episode; Sonarr controls searching and download timing.

Enabling Episode Queue on an **existing** request changes future queueing only.
It keeps the request's existing season and episode selections, and it does not
delete episodes already in Sonarr or the media library. To stop future additions
and remove an episode from Sonarr, turn the queue off first, then manage that
episode in Sonarr.

## Requirements

- SeerrNG is configured to use Plex, Jellyfin, or Emby as its media server.
- Your SeerrNG account is linked to the matching account or user on that
  media server.
- You have permission to request the TV quality selected for the request.
- The series has a TVDB identity so playback can be matched to the request.
- A matching Sonarr destination is configured for the request's standard or 4K
  quality.

## Turn it on or off

Ask a user manager to approve Episode Queue from your profile’s **Episode
Queue** settings. After approval, choose a default from **Off** to five
episodes. The default is used for existing root TV requests and every new TV
request. Existing requests with an explicit show-specific choice keep it.

When creating a request, leave **Episode Queue** on **Use my default** or pick
**Off for this show** or a different buffer to override the account default.
You can change the choice later from the request card in **Requests** or
**Request Status**. User managers can also manage the default and approval from
that user's profile settings.

Choose **Off for this show** to stop future watch-ahead requests. Episodes
already created remain in Sonarr and in SeerrNG's request history. While the
queue remains on, SeerrNG may add a missing episode again if it is needed to
maintain the selected buffer. Episode Queue never deletes downloaded episodes
or files. A user manager can revoke access from the user's profile; this clears
their active queue settings and stops future additions. Episodes already
requested remain in Sonarr and in SeerrNG's request history.

## What SeerrNG does

While at least one request has a buffer enabled, the worker checks active
playback every 30 seconds. A matching episode must reach at least 90% of its
runtime before the queue advances. SeerrNG matches the playing series and
linked account to the TV request owner; another user's playback does not
advance your request. New episodes are reconciled at most once every 15
minutes.

While the TV request is pending approval, SeerrNG remembers your watched
progress but waits to add episodes. Once the request is approved, SeerrNG checks
the selected Sonarr library and requests enough upcoming, missing episodes to
maintain the buffer. Episodes already in the library, monitored by Sonarr, or
covered by another active request count toward that buffer. Specials follow
the administrator's **Enable Special Episodes** setting.

Generated episode requests inherit the approved parent request and do not use
additional request quota. They appear in Requests with a **Requested ahead of
playback** label and do not create a separate approval notification for every
episode. Sonarr remains responsible for searching, downloading, importing, and
tracking the files.

## API

The request owner can update a request through
`PUT /api/v1/request/{requestId}/watch-ahead` with a JSON body such as:

```json
{ "episodeCount": 3 }
```

Use `episodeCount: 0` and `useUserDefault: false` to turn the queue off for this
show. Use `useUserDefault: true` to follow the profile default. Values from 0
through 5 are accepted. Enabling the queue requires manager approval, a linked
account for the configured Plex, Jellyfin, or Emby server, and a matching
Sonarr destination.
