---
category: fixed
audience: users, operators
area: services
action: none
breaking: false
---
Seerr now retries one transient Sonarr, Radarr, and other provider read failure before showing a connection error, reducing false “unable to connect” warnings while preserving persistent failures.
