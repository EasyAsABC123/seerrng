import { accessSync, constants, existsSync, readdirSync } from 'fs';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_DIRECTORY
  ? process.env.CONFIG_DIRECTORY
  : path.join(__dirname, '../../config');

const DOCKER_PATH = `${CONFIG_PATH}/DOCKER`;

export const appDataStatus = (): boolean => {
  return !existsSync(DOCKER_PATH);
};

export const appDataPath = (): string => {
  return CONFIG_PATH;
};

export const appDataPermissions = (): boolean => {
  try {
    accessSync(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
};

/** The process must read and write here; existence alone hides chown mistakes. */
export const appDataWritable = (): boolean => {
  try {
    accessSync(CONFIG_PATH, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Other containers conventionally mount appdata at /config. When that path
 * holds files while the real data directory is an unmounted container layer,
 * the volume was almost certainly mapped to the wrong container path.
 */
const CONVENTIONAL_CONFIG_PATH = '/config';

export const misplacedConfigMount = (): string | undefined => {
  if (
    process.env.CONFIG_DIRECTORY ||
    appDataStatus() ||
    path.resolve(CONFIG_PATH) === CONVENTIONAL_CONFIG_PATH
  ) {
    return undefined;
  }
  try {
    return readdirSync(CONVENTIONAL_CONFIG_PATH).length > 0
      ? CONVENTIONAL_CONFIG_PATH
      : undefined;
  } catch {
    return undefined;
  }
};
