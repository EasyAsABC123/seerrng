---
category: fixed
audience: operators
area: ci
action: none
breaking: false
---

Trusted main-branch Linux validation now routes directly to the shared private JIT runners. Public-fork jobs stay isolated, and Apple and architecture-specific release jobs keep their designated runners. Existing queued and active jobs are left untouched.
