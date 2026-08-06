# Release History Audit

The SeerrNG release history was audited against the repository's version tags
on 2026-08-06.

## Coverage

- `CHANGELOG.md` contains one curated section for each of the 50 `v3.*` tags,
  from `v3.2.1` through `v3.11.2`.
- `v3.2.6` is not listed because no such tag exists.
- Releases that contain only release preparation or CI work are still listed,
  with that scope called out explicitly instead of inventing user-facing
  changes.
- The inherited Jellyseerr/Overseerr entries remain below the SeerrNG history
  under a separate heading.

## Audit method

For each tag, compare its commit range with the previous SeerrNG tag and
summarize changes that affect users, operators, security, integrations,
packaging, or upgrade safety. Release-preparation commits and duplicate draft
release records are not treated as additional software releases. The generated
git-cliff history remains available for commit-level traceability.

The coverage check is automated by
[`scripts/check-changelog-tags.mjs`](../../scripts/check-changelog-tags.mjs).
Pull-request CI and the tag-preparation workflow run it, so a future change
cannot silently remove a historical release section.

## Future releases

The tag workflow generates the new release section, assembles its curated
fragments, and prepends that section to the existing changelog. It does not
regenerate the entire file. This preserves the audited history while allowing
future agents to add normal `release-notes/*.md` fragments for each user-facing
change.
