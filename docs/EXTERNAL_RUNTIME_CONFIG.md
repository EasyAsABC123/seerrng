# External runtime integration configuration

Outbound integrations are configured through the `SEERR_EXTERNAL_CONFIG`
environment variable. Its value is a JSON object containing the integration
sections exported from `settings.json`.

The application does not read integration URLs, credentials, notification
webhooks, or media-server credentials from `settings.json` at runtime. This
keeps those values in the deployment secret manager while leaving the file
available for local metadata and migration state.

To migrate an existing installation, inject the exported JSON directly into
the environment:

```sh
SEERR_EXTERNAL_CONFIG="$(node scripts/export-external-config.mjs /path/to/settings.json)" pnpm start
```

For production, configure the same variable through the deployment secret
manager rather than shell history. The application fails during startup when
the variable is absent or malformed; integrations are not silently disabled.

The value must be supplied directly as an environment variable. The
application intentionally does not support a file-valued fallback such as
`SEERR_EXTERNAL_CONFIG_FILE`.
