import type { AllSettings, NotificationAgentKey } from '@server/lib/settings';

/**
 * Configuration required by integrations that make outbound requests.
 *
 * This deliberately has no file-backed fallback. Secret managers should
 * inject the JSON directly into SEERR_EXTERNAL_CONFIG.
 */
export type ExternalRuntimeConfig = Pick<
  AllSettings,
  | 'vapidPublic'
  | 'vapidPrivate'
  | 'main'
  | 'plex'
  | 'jellyfin'
  | 'oidc'
  | 'tautulli'
  | 'radarr'
  | 'sonarr'
  | 'lidarr'
  | 'readarr'
  | 'notifications'
>;

const MAX_EXTERNAL_CONFIG_BYTES = 2 * 1024 * 1024;
let cachedSource: string | undefined;
let cachedConfig: ExternalRuntimeConfig | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertRecord = (
  value: unknown,
  name: string
): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`SEERR_EXTERNAL_CONFIG.${name} must be an object`);
  }
  return value;
};

const validate = (value: unknown): ExternalRuntimeConfig => {
  const root = assertRecord(value, 'root');
  for (const section of [
    'main',
    'plex',
    'jellyfin',
    'oidc',
    'tautulli',
    'notifications',
  ]) {
    assertRecord(root[section], section);
  }
  for (const service of ['radarr', 'sonarr', 'lidarr', 'readarr']) {
    if (!Array.isArray(root[service])) {
      throw new Error(`SEERR_EXTERNAL_CONFIG.${service} must be an array`);
    }
  }

  const notifications = assertRecord(root.notifications, 'notifications');
  assertRecord(notifications.agents, 'notifications.agents');
  return value as ExternalRuntimeConfig;
};

export const loadExternalRuntimeConfig = (): ExternalRuntimeConfig => {
  const source = process.env.SEERR_EXTERNAL_CONFIG;
  if (!source) {
    throw new Error(
      'SEERR_EXTERNAL_CONFIG is required for outbound integrations. Run scripts/export-external-config.mjs to migrate existing settings.'
    );
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_EXTERNAL_CONFIG_BYTES) {
    throw new Error('SEERR_EXTERNAL_CONFIG exceeds the 2 MiB limit');
  }
  if (source === cachedSource && cachedConfig) {
    return cachedConfig;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error('SEERR_EXTERNAL_CONFIG must contain valid JSON', {
      cause: error,
    });
  }

  cachedSource = source;
  cachedConfig = validate(parsed);
  return cachedConfig;
};

export const getExternalRuntimeConfig = loadExternalRuntimeConfig;

export const getExternalNotificationAgent = <Key extends NotificationAgentKey>(
  key: Key
): AllSettings['notifications']['agents'][Key] => {
  const agent = getExternalRuntimeConfig().notifications.agents[key];
  if (!agent) {
    throw new Error(
      `SEERR_EXTERNAL_CONFIG.notifications.agents.${key} is missing`
    );
  }
  return agent;
};
