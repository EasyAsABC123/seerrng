---
category: fixed
audience: users, operators
area: documentation
action: none
breaking: false
---
Discord notification embeds now respect a custom `PORT` for their fallback application link (was reading the wrong-case `port` and always defaulting to 5055). Also documented several previously undiscoverable environment variables (`SEERR_REQUIRE_PUBLIC_SETUP_HOSTS`, `SEERR_ALLOW_PRIVATE_NOTIFICATION_URLS`, `SEERR_ALLOW_PRIVATE_PUSH_ENDPOINTS`, `SEERR_SKIP_DB_MIGRATIONS`, `JELLYFIN_TYPE`) in the README and Network settings docs.
