# Setup experience contract

This contract applies the same user-centered setup principles to SeerrNG's
existing first-run screen, service settings, media-category controls, and
optional setup assistant. It does not define a second onboarding system.

## Existing surfaces

- `src/components/Setup` is the first-run route. It already steps through
  media-server choice, account access, transport readiness, and enabled server
  libraries.
- **Settings → Services** owns provider URLs, credentials, service-specific
  options, and connection testing.
- **Settings → Media Categories** controls which request types are available.
- `scripts/setup-assistant.mjs` generates Compose stacks or connection
  suggestions; it does not install apps, set API keys, or replace the in-app
  forms.

## Apply the contract here

Keep the first-run screen focused on making SeerrNG accessible and connecting
the media server. Read only state already exposed by the existing settings and
setup APIs. Preserve the current transport and library validation gates.

After that setup, use the existing category and service surfaces to ask the
next relevant question. If an administrator enables a category, show its
supported service choices and the existing **Test** form. If the category is
off, do not ask about its acquisition backend. Movies and television use the
current Radarr/Sonarr and destination forms; music uses Lidarr; comic and
magazine acquisition uses their existing integrations; ROM and PC game setup
stays split between ROMarrNG and QuestarrNG. Book and audiobook questions only
appear when those categories are enabled.

When a value is already configured, show its masked/current status and skip
the question. Ask before changing a saved service, library, request policy, or
category. Reuse the existing connection tests and validation errors. Keep the
user in the current setup or settings flow when opening a relevant form, and
return them to the same point after they save or cancel.

## Contract

- Detect known configuration from existing SeerrNG state; do not infer a
  household's request interests from media already in a library.
- Ask only for missing choices that affect the chosen category or service.
- Use the current settings schemas and save actions as the source of truth.
- Keep API keys in the existing secret fields; never copy them into generated
  assistant files or browser-persisted setup state.
- Make optional services optional, with a clear explanation of what remains
  unavailable when skipped.
- Finish each step with the existing test/validation action and a concise
  summary of configured categories, libraries, and services.
- Keep all settings editable through their existing pages after setup.

Do not add a parallel service registry, integration model, or standalone
cross-product wizard. Improve the current first-run, category, and service
surfaces in place.

## Implementation tasks

Work in this order; service and category settings remain the source of truth.

- [x] **S1 — P1: Make setup step 4 follow enabled request categories.**
  In `src/components/Setup/index.tsx`, pass the existing category state into
  `src/components/Settings/SettingsServices.tsx` and use its current service
  category groups to focus the operator on the services relevant to categories
  they enabled in Media Categories. Keep Prowlarr framed as optional manual
  search support. Do not infer interest from existing library contents.
  **Done when:** a books-only setup does not present movie, TV, music, comic,
  or game services as required; enabling another category exposes its existing
  service forms; saved services remain visible with secrets masked; each form
  still uses its existing Test action.

- [x] **S2 — P1: Show a resumable setup review in the existing final step.**
  Extend the step 4 content in `src/components/Setup/index.tsx` to summarize
  enabled categories and selected media libraries. Show existing saved service
  connections in their category forms, and state that connection-test results
  are live form results because SeerrNG does not persist setup test history.
  **Done when:** the review names enabled categories and libraries, states
  there is no missing required service when a connection is skipped, and
  returning from an inline service form preserves its category and setup step.

- [x] **S3 — P2: Make the existing CLI assistant recommendations selective.**
  Update the prompts and Compose/connection output in
  `scripts/setup-assistant.mjs` so generated examples reflect the service
  types the operator actually selected instead of treating every SeerrNG
  integration as a default. Keep generated output free of API-key values.
  **Done when:** an operator can request recommendations for one or more
  supported categories, irrelevant services are omitted, and the generated
  stack still links to the existing in-app forms for credentials and testing.
