---
title: SeerrNG Companion browser extension
description: Request titles from IMDb, Letterboxd, Steam, Goodreads, and other sites using your own SeerrNG server.
sidebar_position: 15
---

# SeerrNG Companion browser extension

[SeerrNG Companion](https://github.com/snapetech-org/seerrng-companion) is a standalone extension for Chrome, Edge, Brave, and Firefox. It adds a **Request in SeerrNG** button to title pages and a right-click **Find in SeerrNG** item, using SeerrNG's resolve API.

## Set up

1. Build or install the extension (see its README).
2. In SeerrNG, copy your API key from **Settings → General**.
3. Open the extension's options, enter your SeerrNG address and the key, and choose **Save and test**. The browser asks for access to that one server only.

## Use

- On a supported title page, press the button. SeerrNG lists the matches with why each matched; press **Request** on the right one. Games and anime sources open in SeerrNG.
- Right-click a link, selected text, or an image and choose **Find in SeerrNG**.
- The toolbar popup resolves a pasted link, ISBN, or list of titles.

## Security notes

- The API key is stored only in the browser profile and used only by the extension's background worker, never by a web page.
- The key acts as the SeerrNG user it belongs to. Rotate it in SeerrNG if a browser profile is shared or lost.
- Nothing is sent until you press a button or menu item.

## Keyboard and accessibility

The popup and options page use native controls with labels, so they work with the keyboard and screen readers. The in-page panel appears next to the button and returns focus to it when closed.
