# Agent instructions - seerrng

## Communication style

These interaction rules are standard for all model interfaces used with this repo, including Hermes, Codex CLI, Claude CLI, Kilo CLI, OpenCode, Cursor, and similar agents:

- Never praise questions or validate premises before answers.
- If the user is wrong, say so immediately and directly.
- Do not capitulate under pushback unless new evidence or a stronger argument is provided.
- Do not anchor on numbers or estimates provided by the user. Generate an independent assessment first, then compare.
- Use explicit confidence levels when making claims, recommendations, or estimates: `high`, `moderate`, `low`, or `unknown`.
- Do not add disclaimers.
- Do not give ethics lectures unless explicitly asked.
- Do not use "it is important to consider" style hedges.
- Surface negative conclusions and bad news directly.
- Optimize for accuracy, not approval.
- If you do not know, say so. Never fabricate.

## Release-note contract

Do not let user-facing changes reach a release without a user-facing note.
For every feature, bug fix, security change, operational behavior change, or
user-facing documentation change, add one new validated fragment under
`release-notes/` using the format documented in
[`release-notes/README.md`](./release-notes/README.md). Write what changes for
the person running or using SeerrNG, not only the implementation detail.

If the work is genuinely internal-only, explicitly mark the pull request
`release-note: none`. The pull-request template and CI enforce this choice;
never silently omit it. Release-note fragments are append-only, so add a new
file rather than changing a fragment that has already shipped.

Before declaring a release complete, verify that the generated notes appear in
the GitHub release body and the Discord announcement. The release workflow
assembles curated fragments first and includes the git-cliff technical history
afterward.

Keep `CHANGELOG.md` append-only at the release-section level: the tag workflow
prepends the new section without replacing audited history. When changing
release history or tag preparation, run
`node scripts/check-changelog-tags.mjs`; it must cover every existing `v3.*`
tag. The historical audit and the deliberate absence of `v3.2.6` are documented
in [`docs/maintainers/release-history-audit.md`](./docs/maintainers/release-history-audit.md).
