import fs from 'node:fs';
import path from 'node:path';

export const assertNoSymlinkDirectoryComponents = (
  directory: string,
  options: { allowMissing?: boolean; label?: string } = {}
): void => {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  const components = resolved
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);
  let current = root;

  for (const component of components) {
    current = path.join(current, component);

    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (
        options.allowMissing &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return;
      }
      throw error;
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `${options.label ?? 'Directory path'} must not contain symlinks: ${current}`
      );
    }
    if (!stat.isDirectory()) {
      throw new Error(
        `${options.label ?? 'Directory path'} contains a non-directory component: ${current}`
      );
    }
  }
};
