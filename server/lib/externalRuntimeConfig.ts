import type { AllSettings, NotificationAgentKey } from '@server/lib/settings';

/**
 * Configuration required by integrations that make outbound requests.
 *
 * This deliberately has no file-backed fallback. Secret managers should
 * inject the JSON directly into SEERR_EXTERNAL_CONFIG.
 */
export type ExternalRuntimeConfig = Pick<
  AllSettings,
  | 'clientId'
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
  | 'network'
>;

const MAX_EXTERNAL_CONFIG_BYTES = 2 * 1024 * 1024;
let cachedSource: string | undefined;
let cachedConfig: ExternalRuntimeConfig | undefined;
type ExternalRuntimeConfigTestProvider = () => unknown;
const TEST_RUNTIME_CONFIG_SYMBOL = Symbol.for(
  'seerrng.test.externalRuntimeConfig'
);

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
  if (typeof root.clientId !== 'string' || root.clientId.length === 0) {
    throw new Error(
      'SEERR_EXTERNAL_CONFIG.clientId must be a non-empty string'
    );
  }
  for (const section of [
    'main',
    'plex',
    'jellyfin',
    'oidc',
    'tautulli',
    'notifications',
    'network',
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

const getTestProvider = (): ExternalRuntimeConfigTestProvider | undefined => {
  const provider = Reflect.get(globalThis, TEST_RUNTIME_CONFIG_SYMBOL);
  return typeof provider === 'function'
    ? (provider as ExternalRuntimeConfigTestProvider)
    : undefined;
};

export const loadExternalRuntimeConfig = (): ExternalRuntimeConfig => {
  const source = process.env.SEERR_EXTERNAL_CONFIG;
  if (!source) {
    const provider =
      process.env.NODE_ENV === 'test' ? getTestProvider() : undefined;
    if (provider) {
      return validate(provider());
    }
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
