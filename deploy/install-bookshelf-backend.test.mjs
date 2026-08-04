import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve('deploy/install-bookshelf-backend.sh');
const temporaryDirectories = new Set();

const createTemporaryDirectory = async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'seerr-bookshelf-install-')
  );
  temporaryDirectories.add(directory);
  return directory;
};

const runInstaller = (environment, ...arguments_) =>
  new Promise((resolve) => {
    const child = spawn(scriptPath, arguments_, {
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code, signal) =>
      resolve({ code, signal, stderr, stdout })
    );
  });

const baseEnvironment = (root) => ({
  BACKUP_DIR: path.join(root, 'backup'),
  BOOKSHELF_AUDIOBOOKS_CONFIG_DIR: path.join(root, 'target', 'audiobooks'),
  BOOKSHELF_EBOOKS_CONFIG_DIR: path.join(root, 'target', 'ebooks'),
  INSTALL_DIR: path.join(root, 'install'),
  RREADING_GLASSES_POSTGRES_DIR: path.join(root, 'target', 'postgres'),
});

const createDeploymentEnvironment = async (root) => {
  const environment = baseEnvironment(root);
  const executableDirectory = path.join(root, 'bin');
  await mkdir(executableDirectory, { recursive: true });
  await mkdir(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, { recursive: true });
  await mkdir(environment.BOOKSHELF_AUDIOBOOKS_CONFIG_DIR, {
    recursive: true,
  });
  await writeFile(
    path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'config.xml'),
    '<Config><ApiKey>ebook-secret</ApiKey></Config>'
  );
  await writeFile(
    path.join(environment.BOOKSHELF_AUDIOBOOKS_CONFIG_DIR, 'config.xml'),
    '<Config><ApiKey>audiobook-secret</ApiKey></Config>'
  );
  const dockerPath = path.join(executableDirectory, 'docker');
  await writeFile(dockerPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const curlPath = path.join(executableDirectory, 'curl');
  await writeFile(curlPath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return {
    ...environment,
    BOOKSHELF_BACKEND: 'hardcover',
    HARDCOVER_AUTH: 'Bearer test-token',
    MEDIA_ROOT: root,
    DOWNLOAD_ROOT: root,
    PLEX_ROOT: root,
    PATH: `${executableDirectory}:${process.env.PATH}`,
  };
};

afterEach(async () => {
  await Promise.all(
    [...temporaryDirectories].map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
  temporaryDirectories.clear();
});

describe('Bookshelf backup restoration', () => {
  it('extracts a regular archive through a private staging directory', async () => {
    const root = await createTemporaryDirectory();
    const environment = baseEnvironment(root);
    const source = path.join(root, 'source', 'original-ebooks');
    await mkdir(source, { recursive: true });
    await mkdir(environment.BACKUP_DIR, { recursive: true });
    await writeFile(path.join(source, 'config.xml'), '<ApiKey>secret</ApiKey>');
    await execFileAsync('tar', [
      '-C',
      path.dirname(source),
      '-czf',
      path.join(environment.BACKUP_DIR, 'bookshelf-ebooks-config.tgz'),
      path.basename(source),
    ]);

    const result = await runInstaller(environment, '--restore-backup');

    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      await readFile(
        path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'config.xml'),
        'utf8'
      ),
      '<ApiKey>secret</ApiKey>'
    );
  });

  it('rejects archive path traversal before changing the target', async () => {
    const root = await createTemporaryDirectory();
    const environment = baseEnvironment(root);
    const source = path.join(root, 'source', 'payload');
    await mkdir(source, { recursive: true });
    await mkdir(environment.BACKUP_DIR, { recursive: true });
    await mkdir(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, { recursive: true });
    await writeFile(path.join(source, 'escape'), 'attacker');
    await writeFile(
      path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'keep'),
      'original'
    );
    await execFileAsync('tar', [
      '-C',
      path.dirname(source),
      '--transform=s#^payload#../escaped#',
      '-czf',
      path.join(environment.BACKUP_DIR, 'bookshelf-ebooks-config.tgz'),
      path.basename(source),
    ]);

    const result = await runInstaller(environment, '--restore-backup');

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Unsafe path in restore archive/);
    assert.equal(
      await readFile(
        path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'keep'),
        'utf8'
      ),
      'original'
    );
  });

  it('rejects symlinks before replacing an existing target', async () => {
    const root = await createTemporaryDirectory();
    const environment = baseEnvironment(root);
    const source = path.join(root, 'source', 'linked-ebooks');
    await mkdir(source, { recursive: true });
    await mkdir(environment.BACKUP_DIR, { recursive: true });
    await mkdir(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, { recursive: true });
    await writeFile(path.join(root, 'outside'), 'private');
    await symlink(path.join(root, 'outside'), path.join(source, 'config.xml'));
    await writeFile(
      path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'keep'),
      'original'
    );
    await execFileAsync('tar', [
      '-C',
      path.dirname(source),
      '-czf',
      path.join(environment.BACKUP_DIR, 'bookshelf-ebooks-config.tgz'),
      path.basename(source),
    ]);

    const result = await runInstaller(environment, '--restore-backup');

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /unsafe filesystem entries/);
    assert.equal(
      await readFile(
        path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'keep'),
        'utf8'
      ),
      'original'
    );
  });
});

describe('Bookshelf backup permissions', () => {
  it('requires Hardcover authentication for Hardcover deployments', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    delete environment.HARDCOVER_AUTH;

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 2);
    assert.match(result.stderr, /HARDCOVER_AUTH is required/);
    await assert.rejects(readFile(path.join(environment.INSTALL_DIR, '.env')), {
      code: 'ENOENT',
    });
  });

  it('renders the official Hardcover image and auth contract', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 0, result.stderr);
    const compose = await readFile(
      path.join(environment.INSTALL_DIR, 'compose.yml'),
      'utf8'
    );
    const env = await readFile(
      path.join(environment.INSTALL_DIR, '.env'),
      'utf8'
    );
    assert.match(compose, /rreading-glasses:hardcover@sha256:/);
    assert.match(compose, /entrypoint: \['\/main', 'serve'\]/);
    assert.doesNotMatch(compose, /\/bin\/sh/);
    assert.match(env, /HARDCOVER_AUTH=Bearer test-token/);
  });

  it('selects the Goodreads image and upstream in softcover mode', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    environment.BOOKSHELF_BACKEND = 'softcover';
    delete environment.HARDCOVER_AUTH;

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 0, result.stderr);
    const env = await readFile(
      path.join(environment.INSTALL_DIR, '.env'),
      'utf8'
    );
    assert.match(
      env,
      /RREADING_GLASSES_IMAGE=blampe\/rreading-glasses:latest@sha256:/
    );
    assert.match(env, /RREADING_GLASSES_UPSTREAM=www\.goodreads\.com/);
  });

  it('creates private backup directories, archives, and manifests', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    const outsideEnvironment = path.join(root, 'outside-environment');
    const outsideCompose = path.join(root, 'outside-compose');
    await mkdir(environment.INSTALL_DIR, { recursive: true });
    await writeFile(outsideEnvironment, 'unchanged-environment');
    await writeFile(outsideCompose, 'unchanged-compose');
    await symlink(
      outsideEnvironment,
      path.join(environment.INSTALL_DIR, '.env')
    );
    await symlink(
      outsideCompose,
      path.join(environment.INSTALL_DIR, 'compose.yml')
    );

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 0, result.stderr);
    assert.equal(
      await readFile(outsideEnvironment, 'utf8'),
      'unchanged-environment'
    );
    assert.equal(await readFile(outsideCompose, 'utf8'), 'unchanged-compose');
    assert.equal(
      (await stat(path.join(environment.INSTALL_DIR, '.env'))).mode & 0o777,
      0o600
    );
    assert.equal(
      (await stat(path.join(environment.INSTALL_DIR, 'compose.yml'))).mode &
        0o777,
      0o644
    );
    assert.equal((await stat(environment.BACKUP_DIR)).mode & 0o777, 0o700);
    for (const name of [
      'bookshelf-ebooks-config.tgz',
      'bookshelf-audiobooks-config.tgz',
      'backup-manifest.json',
    ]) {
      assert.equal(
        (await stat(path.join(environment.BACKUP_DIR, name))).mode & 0o777,
        0o600,
        name
      );
    }
  });

  it('refuses a pre-planted archive symlink without modifying its target', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    const outside = path.join(root, 'outside');
    await mkdir(environment.BACKUP_DIR, { mode: 0o700, recursive: true });
    await writeFile(outside, 'unchanged');
    await symlink(
      outside,
      path.join(environment.BACKUP_DIR, 'bookshelf-ebooks-config.tgz')
    );

    const result = await runInstaller(environment, '--skip-pull');

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Backup archive already exists/);
    assert.equal(await readFile(outside, 'utf8'), 'unchanged');
  });

  it('refuses a symlinked backup directory', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    const outsideDirectory = path.join(root, 'outside-backups');
    await mkdir(outsideDirectory, { mode: 0o700, recursive: true });
    await symlink(outsideDirectory, environment.BACKUP_DIR);

    const result = await runInstaller(environment, '--skip-pull');

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /symlinked private directory/);
    assert.deepEqual(await readdir(outsideDirectory), []);
  });

  it('replaces planted migration artifact symlinks without following them', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    const migrationDirectory = path.join(
      environment.BACKUP_DIR,
      'hardcover-migration'
    );
    const outside = path.join(root, 'outside-report');
    const reportPath = path.join(migrationDirectory, 'migration-report.json');
    await mkdir(migrationDirectory, { mode: 0o700, recursive: true });
    await writeFile(outside, 'unchanged');
    await symlink(outside, reportPath);

    const result = await runInstaller(
      environment,
      '--migrate-to-hardcover',
      '--skip-pull'
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(outside, 'utf8'), 'unchanged');
    const reportHandle = await open(reportPath, 'r');
    try {
      assert.equal((await reportHandle.stat()).mode & 0o777, 0o600);
      assert.equal(
        JSON.parse(await reportHandle.readFile('utf8')).status,
        'matching_complete'
      );
    } finally {
      await reportHandle.close();
    }
  });

  it('rejects control characters before writing deployment inputs', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    environment.BOOKSHELF_METADATA_URL =
      'https://example.invalid\nCOMPOSE_PROFILES=attacker';

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 2);
    assert.match(
      result.stderr,
      /BOOKSHELF_METADATA_URL must not contain control characters/
    );
    await assert.rejects(readFile(path.join(environment.INSTALL_DIR, '.env')), {
      code: 'ENOENT',
    });
  });

  it('rejects malformed ports before editing Bookshelf XML', async () => {
    const root = await createTemporaryDirectory();
    const environment = await createDeploymentEnvironment(root);
    environment.BOOKSHELF_EBOOKS_PORT = '8787</Port><ApiKey>attacker';

    const result = await runInstaller(environment, '--skip-pull');

    assert.equal(result.code, 2);
    assert.match(result.stderr, /BOOKSHELF_EBOOKS_PORT must be an integer/);
    assert.equal(
      await readFile(
        path.join(environment.BOOKSHELF_EBOOKS_CONFIG_DIR, 'config.xml'),
        'utf8'
      ),
      '<Config><ApiKey>ebook-secret</ApiKey></Config>'
    );
  });
});
