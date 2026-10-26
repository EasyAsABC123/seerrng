---
category: fixed
audience: users, operators
area: sonarr
action: none
breaking: false
---

New TV requests to Sonarr v5 include the required metadata language and season order, preventing empty-field failures. Sonarr server settings now offer defaults for new-series metadata language and season order; request overrides take priority and existing series keep their metadata.
