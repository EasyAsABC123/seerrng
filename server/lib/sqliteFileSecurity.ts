import fs from 'node:fs';
import path from 'node:path';
import { assertNoSymlinkDirectoryComponents } from './pathSecurity';

export const PRIVATE_SQLITE_DIRECTORY_MODE = 0o700;
export const PRIVATE_SQLITE_FILE_MODE = 0o600;

const lstatIfPresent = (filePath: string): fs.Stats | undefined => {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

export const secureSqliteDatabaseFiles = (databasePath: string): void => {
  const databaseDirectory = path.dirname(databasePath);
  assertNoSymlinkDirectoryComponents(databaseDirectory, {
    allowMissing: true,
    label: 'SQLite database directory',
  });
  const directoryStat = lstatIfPresent(databaseDirectory);
  if (directoryStat) {
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      throw new Error('SQLite database directory must not be a symlink');
    }
    fs.chmodSync(databaseDirectory, PRIVATE_SQLITE_DIRECTORY_MODE);
  }

  for (const filePath of [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
  ]) {
    const fileStat = lstatIfPresent(filePath);
    if (!fileStat) {
      continue;
    }
    if (
      !fileStat.isFile() ||
      fileStat.isSymbolicLink() ||
      fileStat.nlink !== 1
    ) {
      throw new Error(
        `SQLite database path must be a regular file: ${filePath}`
      );
    }

    const descriptor = fs.openSync(
      filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0)
    );
    try {
      const descriptorStat = fs.fstatSync(descriptor);
      if (!descriptorStat.isFile() || descriptorStat.nlink !== 1) {
        throw new Error(
          `SQLite database path must be a regular file: ${filePath}`
        );
      }
      fs.fchmodSync(descriptor, PRIVATE_SQLITE_FILE_MODE);
    } finally {
      fs.closeSync(descriptor);
    }
  }
};
