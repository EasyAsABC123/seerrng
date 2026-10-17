---
category: fixed
audience: operators
area: distribution
action: Update existing Unraid installs from ghcr.io/snapetech/seerrng to ghcr.io/snapetech-org/seerrng:latest while keeping the current /app/config host path.
breaking: false
---
The Community Apps template now calls out the SeerrNG image registry move. Existing installations can keep pointing at the old image path until the Repository field is updated, so the template and Unraid guide now explain how to switch without changing the config mount.
