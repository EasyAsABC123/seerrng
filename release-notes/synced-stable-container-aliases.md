---
category: fixed
audience: operators
area: containers
action: none
breaking: false
---
Validated stable releases now publish matching `:main` and `:latest` aliases to GHCR and Docker Hub. Main-branch CI publishes commit-specific images without moving either stable alias, and the Unraid Compose stack follows the stable `:latest` tags for companion apps.
