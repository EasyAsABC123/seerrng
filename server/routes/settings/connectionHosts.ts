import { MAX_SAVED_CONNECTION_HOSTS } from '@server/constants/connectionHosts';
import { Permission } from '@server/lib/permissions';
import type { SavedConnectionHost } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { authorizedMutation } from '@server/middleware/authorizedMutation';
import { normalizeServiceHostname } from '@server/utils/serviceUrl';
import { Router } from 'express';

const containsControlCharacters = (value: string): boolean =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
  });

const parseSavedConnectionHosts = (
  body: unknown
): { value: SavedConnectionHost[] } | { error: string } => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Settings body must be an object.' };
  }

  const hosts = (body as Record<string, unknown>).hosts;
  if (!Array.isArray(hosts) || hosts.length > MAX_SAVED_CONNECTION_HOSTS) {
    return {
      error: `hosts must be an array with at most ${MAX_SAVED_CONNECTION_HOSTS} entries.`,
    };
  }

  const parsed: SavedConnectionHost[] = [];
  const names = new Set<string>();

  for (const candidate of hosts) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      return { error: 'Each saved host must include a name and hostname.' };
    }

    const record = candidate as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const hostnameValue =
      typeof record.hostname === 'string' ? record.hostname.trim() : '';
    const hostname = normalizeServiceHostname(hostnameValue);
    const nameKey = name.toLowerCase();

    if (
      !name ||
      name.length > 64 ||
      containsControlCharacters(name) ||
      !hostname ||
      hostnameValue.includes('/') ||
      containsControlCharacters(hostnameValue) ||
      hostname.length > 255
    ) {
      return {
        error:
          'Each saved host needs a name up to 64 characters and a hostname or IP address without a scheme or port.',
      };
    }

    try {
      if (new URL(`http://${hostname}`).port) {
        return {
          error: 'Saved hostnames must not include a port.',
        };
      }
    } catch {
      return { error: 'Each saved hostname or IP address must be valid.' };
    }

    if (names.has(nameKey)) {
      return { error: 'Saved host names must be unique.' };
    }
    names.add(nameKey);
    parsed.push({ name, hostname });
  }

  return { value: parsed };
};

const connectionHostsRoutes = Router();

connectionHostsRoutes.get('/', (_req, res) =>
  res.status(200).json(getSettings().main.connectionHosts ?? [])
);

connectionHostsRoutes.put(
  '/',
  authorizedMutation(Permission.ADMIN, async (req, res) => {
    const parsed = parseSavedConnectionHosts(req.body);
    if ('error' in parsed) {
      return res.status(400).json({ message: parsed.error });
    }

    const main = await getSettings().persistSection('main', (current) => ({
      ...current,
      connectionHosts: parsed.value,
    }));

    return res.status(200).json(main.connectionHosts ?? []);
  })
);

export default connectionHostsRoutes;
