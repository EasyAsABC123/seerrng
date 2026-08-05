# Session Cookie Transport Decision

**Date:** 2026-08-05
**Status:** Production cookies require HTTPS.

SeerrNG uses an `express-session` cookie to carry the authenticated browser
session, including the session created by Plex sign-in. The current
configuration uses a secure session cookie in production:

- Production sets the `Secure` attribute unconditionally. When SeerrNG is
  behind a trusted TLS terminator, `express-session` uses
  `X-Forwarded-Proto: https` to validate the request transport.
- Development keeps the framework default so local HTTP testing remains
  possible.

## Why production requires HTTPS

The production deployment uses `https://request.snape.tech` and has proxy
trust enabled for its TLS terminator. A browser must use that HTTPS endpoint
for production sign-in. Direct `http://kspls0:5055` access is a diagnostic or
development path, not a supported production authentication origin.

This prevents an authenticated session from being sent over clear-text HTTP.
The `js/clear-text-cookie` finding that motivated this change should resolve in
the next CodeQL scan; it must not be dismissed or hidden with a query
configuration.

## Chosen behavior

Production session cookies are secure, `httpOnly`, and use the existing
CSRF-dependent `SameSite` policy. Development does not receive the production
transport restriction.
