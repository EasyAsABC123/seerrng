import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const readPersistedTlsSettings = () => {
  const configDirectory = process.env.CONFIG_DIRECTORY ?? '/app/config';
  try {
    const settings = JSON.parse(
      fs.readFileSync(path.join(configDirectory, 'settings.json'), 'utf8')
    );
    return settings?.network?.tls ?? {};
  } catch {
    return {};
  }
};

const persistedTlsSettings = readPersistedTlsSettings();
const tlsMode = (
  process.env.SEERR_TLS_MODE ??
  persistedTlsSettings.mode ??
  'disabled'
).toLowerCase();
const tlsEnabled = tlsMode === 'self-signed' || tlsMode === 'provided';
const readinessPath = process.argv[2] ?? '/api/v1/status/ready';
const port = Number(
  tlsEnabled
    ? (process.env.SEERR_HTTPS_PORT ?? persistedTlsSettings.httpsPort ?? '5056')
    : (process.env.PORT ?? '5055')
);
const client = tlsEnabled ? https : http;

const request = client.get(
  {
    hostname: '127.0.0.1',
    path: readinessPath,
    port,
    ...(tlsEnabled ? { rejectUnauthorized: false } : {}),
  },
  (response) => {
    response.resume();
    response.once('end', () => {
      process.exit(response.statusCode === 204 ? 0 : 1);
    });
  }
);

request.setTimeout(3_000, () => request.destroy());
request.once('error', () => process.exit(1));
