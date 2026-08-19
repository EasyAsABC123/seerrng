---
title: Network
description: Configure Network settings.
sidebar_position: 7
---

# Network

Network-related settings are available in the **Network** tab under **Settings**. These options control how Seerr communicates with external services

## DNS Caching

Seerr allows you to enable DNS caching if you are experiencing DNS-related issues. When enabled, it improves performance and reduces the number of DNS lookups required for external API calls. This can help speed up response times and reduce the load on DNS servers, especially when a local resolver like Pi-hole is used.

### Configuration

You can enable the DNS caching settings in the Network tab of the Seerr settings. The default values follow the standard DNS caching behavior.

- **Force Minimum TTL**: Set a minimum time-to-live (TTL) in seconds for DNS cache entries. This ensures that frequently accessed DNS records are cached for a longer period, reducing the need for repeated lookups. Default is 0.
- **Force Maximum TTL**: Set a maximum time-to-live (TTL) in seconds for DNS cache entries. This prevents infrequently accessed DNS records from being cached indefinitely, allowing for more up-to-date information to be retrieved. Default is -1 (unlimited).

## Force IPv4 resolution first

Sometimes there are configuration issues with IPv6 that prevent the hostname resolution from working correctly.

You can force resolution to prefer IPv4 by going to `Settings > Network`, enabling `Force IPv4 Resolution First`, and then restarting Seerr.

## HTTP(S) Proxy

If you can't change your DNS servers or force IPV4 resolution, you can use Seerr through a proxy.

In some places (like China), the ISP blocks not only the DNS resolution but also the connection to the TMDB API.

## Enable Proxy Support

If you have Seerr behind a reverse proxy, enable this setting to allow Seerr to correctly register client IP addresses. For details, please see the [Express Documentation](https://expressjs.com/en/guide/behind-proxies.html).

This setting is **disabled** by default.

## Enable CSRF Protection

:::warning
**This is an advanced setting.** Please only enable this setting if you are familiar with CSRF protection and how it works.
:::

CSRF stands for [cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery). When this setting is enabled, all external API access that alters Seerr application data is blocked.

If you do not use Seerr integrations with third-party applications to add/modify/delete requests or users, you can consider enabling this setting to protect against malicious attacks.

The CSRF cookie's transport policy follows the request: it is marked `Secure` on HTTPS (including behind a reverse proxy that forwards `X-Forwarded-Proto: https`) and left unmarked on direct HTTP/LAN access, so enabling this setting does not by itself require HTTPS.

If you enable this setting and find yourself unable to access Seerr, you can disable the setting by modifying `settings.json` in `/app/config`.

This setting is **disabled** by default.

## Session cookies and HTTP

Plex sign-in creates a browser session cookie. SeerrNG keeps direct HTTP
support for LAN deployments by using an automatic cookie policy: HTTPS
requests receive a `Secure` session cookie, while direct HTTP requests can
retain the session required to complete Plex sign-in.

Direct HTTP is not suitable for untrusted networks because an authenticated
session can be observed or modified in transit. To protect sessions and clear
the corresponding security finding, place SeerrNG behind a working HTTPS
reverse proxy that redirects HTTP to HTTPS. Do not change the application to
use `Secure` cookies unconditionally before that proxy is deployed; doing so
breaks Plex sign-in for direct HTTP deployments.

## API Request Timeout

The API Request Timeout setting defines the maximum time (in seconds) Seerr will wait for a response from external services, such as Radarr or Sonarr. The default value is 10 seconds, though it can be entirely disabled by setting it to 0. Please note that any changes to this value require restarting Seerr to take effect.

Enforcing a timeout ensures the Seerr interface remains responsive and prevents infinite loading states when a connected service unexpectedly goes offline. Conversely, you may want to increase this value if you frequently experience failed requests due to your external services being slow to respond, which often happens when they are under heavy load or querying network-mounted storage.
