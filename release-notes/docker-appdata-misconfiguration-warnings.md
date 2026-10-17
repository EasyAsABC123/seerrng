---
category: fixed
audience: operators
area: docker
action: Map the host appdata folder to /app/config and make it writable by UID 1000 and GID 1000.
breaking: false
---
Administrators now see a warning in the app and a specific startup error when the data folder is not a mounted volume, when files sit at /config instead of /app/config, or when the folder is not writable by the container user.
