# Sonarr v5 server defaults verification

Scope: PR #406, based on upstream `a0fb796`, extends the required-field fix with
new-series metadata defaults in Settings → Services → Add/Edit Sonarr Server.
The deployment used for verification is an isolated local build with disposable
E2E settings and database, not the homelab service.

## Ownership and behavior

The two new rows use the existing `form-row`, `text-label`, `form-input-area`,
`form-input-field`, SettingsField select, and `settings-form-row-description`
owners. No CSS, Tailwind utilities, theme values, or shared geometry were added.
Labels are associated with controls; descriptions use `aria-describedby`.

Default Metadata Language starts at Automatic (from Sonarr). Default Season
Order starts at Aired Order and also supports Automatic (from Sonarr). Connection
testing supplies v5 language options. Sonarr v3/v4 retain the existing language
profile controls and hide the new fields. Optional settings require no database
migration. Omitted API fields preserve saved settings; null clears a saved
metadata-language default.

Dispatch passes server defaults separately from request overrides. The Sonarr
adapter only applies defaults when creating a series. Explicit request choices
take priority; ordinary requests for an existing series preserve its metadata
language and season order.

## Rendered and functional evidence

Compared the original form at PR commit `1466dc4` with the candidate at matching
1280 × 1000 and 390 × 844 CSS viewports. Both use the loaded new-server form,
quality profile 7, and `/mnt/TV Shows` root folder. Inspected field geometry,
label alignment, helper-text wrapping, horizontal bounds, and neighboring
quality/root-folder, tag, and anime controls. Desktop retains its label/control
columns; narrow layouts stack the new rows without clipping. The form remains
vertically scrollable. Existing shared styling and native-select presentation
are preserved; this is not a broader settings-style migration.

Local screenshot artifacts (not committed):

- `/tmp/seerr-sonarr-baseline-1280.png`
- `/tmp/seerr-sonarr-baseline-390.png`
- `/tmp/seerr-sonarr-candidate-1280.png`
- `/tmp/seerr-sonarr-candidate-390.png`

`playwright/sonarr-defaults.spec.ts` verifies the initial values, both viewport
bounds, selecting French and Automatic order, actual API persistence in the
isolated config, editing and reloading the saved selections, clearing the
language back to Automatic, restoring Aired Order, and hiding the v5 controls
when the connection returns legacy language profiles. Connection metadata is
mocked; no real Sonarr request or media download is performed by this test.

Backend regression tests cover server defaults, explicit request precedence,
lookup fallbacks, original-language/English fallback, existing-series
preservation, v3 compatibility, strict settings parsing, create/update/read
round trips, and version-specific connection-test metadata.
