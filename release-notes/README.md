# Release-note fragments

Add one Markdown fragment for every user-facing pull request. The release
workflow carries these fragments into `CHANGELOG.md`, GitHub Releases, and the
Discord release announcement.

Use a short, user-facing description rather than an implementation detail:

```md
---
category: fixed
---
Hardcover-backed book searches now keep working from cached metadata during a short upstream outage.
```

Allowed categories are `added`, `changed`, `fixed`, `security`, `removed`, and
`deprecated`. Fragment files are append-only. Add a new file instead of
rewriting a fragment that was already released.

If a pull request is entirely internal and has no user-visible effect, select
the internal-only release-note option in the pull request template or add
`release-note: none` to the description. Do not use that opt-out to avoid
describing a feature, bug fix, security change, operational behavior, or
user-facing documentation change.
