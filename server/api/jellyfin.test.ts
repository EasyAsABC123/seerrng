import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import JellyfinAPI, {
  MAX_JELLYFIN_SEASONS,
  MAX_JELLYFIN_USERS,
  sanitizeJellyfinLibraryItem,
  sanitizeJellyfinLoginResponse,
  sanitizeJellyfinSystemInfo,
  sanitizeJellyfinUsers,
} from './jellyfin';

class TestJellyfinAPI extends JellyfinAPI {
  public getLookup() {
    return this.axios.defaults.lookup;
  }
}

const runLookup = (
  lookup: ReturnType<TestJellyfinAPI['getLookup']>,
  hostname: string
) =>
  new Promise<void>((resolve, reject) => {
    lookup?.(hostname, { all: true }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

describe('JellyfinAPI address policy', () => {
  it('can block private addresses during unauthenticated setup', async () => {
    const api = new TestJellyfinAPI(
      'http://public.example',
      undefined,
      undefined,
      false
    );

    await assert.rejects(
      runLookup(api.getLookup(), 'localhost'),
      (error: NodeJS.ErrnoException) => error.code === 'EACCES'
    );
  });

  it('retains private network support for configured media servers', async () => {
    const api = new TestJellyfinAPI('http://localhost');

    await assert.doesNotReject(runLookup(api.getLookup(), 'localhost'));
  });
});

describe('Jellyfin response normalization', () => {
  it('caps users and drops provider credentials and unknown fields', () => {
    const users = sanitizeJellyfinUsers([
      null,
      { Id: '', Name: 'Missing id' },
      ...Array.from({ length: MAX_JELLYFIN_USERS + 100 }, (_, index) => ({
        Id: `user-${index}`,
        Name: `User ${index}`,
        Policy: { IsAdministrator: index === 0, hidden: 'provider-only' },
        AccessToken: 'provider-user-secret',
        providerOnly: true,
      })),
    ]);

    assert.strictEqual(users.length, MAX_JELLYFIN_USERS - 2);
    assert.strictEqual(users[0].Policy.IsAdministrator, true);
    assert.ok(!('AccessToken' in users[0]));
    assert.ok(!('providerOnly' in users[0]));
  });

  it('requires a bounded login token and valid user', () => {
    const login = sanitizeJellyfinLoginResponse({
      User: { Id: 'user', Name: 'User' },
      AccessToken: 'token',
      providerOnly: true,
    });
    assert.deepStrictEqual(Object.keys(login).sort(), ['AccessToken', 'User']);
    assert.throws(
      () =>
        sanitizeJellyfinLoginResponse({
          User: { Id: 'user', Name: 'User' },
          AccessToken: '',
        }),
      /invalid authentication response/
    );
    assert.throws(
      () =>
        sanitizeJellyfinLoginResponse({
          User: { Id: 'user', Name: 'User' },
          AccessToken: 'x'.repeat(4_097),
        }),
      /invalid authentication response/
    );
  });

  it('exposes only bounded system identity fields', () => {
    assert.deepStrictEqual(
      sanitizeJellyfinSystemInfo({
        Id: 'server',
        ServerName: 'Jellyfin',
        LocalAddress: 'http://internal.example',
        AccessToken: 'secret',
      }),
      { Id: 'server', ServerName: 'Jellyfin' }
    );
    assert.strictEqual(sanitizeJellyfinSystemInfo(null), undefined);
  });

  it('normalizes library metadata and bounds nested media information', () => {
    const item = sanitizeJellyfinLibraryItem(
      {
        Id: 'movie',
        Name: 'Movie',
        Type: 'Movie',
        LocationType: 'FileSystem',
        ProviderIds: {
          Tmdb: '123',
          providerSecret: 'secret',
        },
        MediaSources: [
          {
            Id: 'source',
            Path: '/media/movie.mkv',
            MediaStreams: [
              {
                Codec: 'hevc',
                Type: 'Video',
                Width: 3840,
                providerOnly: true,
              },
              { Type: 'Executable', Path: '/bin/sh' },
            ],
            providerOnly: true,
          },
        ],
        AccessToken: 'provider-secret',
        providerOnly: true,
      },
      true
    );

    assert.ok(item && 'ProviderIds' in item);
    assert.deepStrictEqual(item.ProviderIds, {
      Tmdb: '123',
      TheMovieDb: undefined,
      Imdb: undefined,
      Tvdb: undefined,
      AniDB: undefined,
    });
    assert.strictEqual(item.MediaSources?.length, 1);
    assert.strictEqual(item.MediaSources?.[0].MediaStreams.length, 1);
    assert.ok(!('providerOnly' in item));
    assert.ok(!('AccessToken' in item));
    assert.ok(!('providerOnly' in (item.MediaSources?.[0] ?? {})));
    assert.ok(
      !('providerOnly' in (item.MediaSources?.[0].MediaStreams[0] ?? {}))
    );
  });

  it('bounds season collections and encodes provider path identifiers', async () => {
    const api = new JellyfinAPI('http://localhost');
    let endpoint = '';
    Object.defineProperty(api, 'get', {
      configurable: true,
      value: async (value: string) => {
        endpoint = value;
        return {
          Items: [
            null,
            ...Array.from(
              { length: MAX_JELLYFIN_SEASONS + 100 },
              (_, index) => ({
                Id: String(index),
                Type: 'Season',
                providerOnly: true,
              })
            ),
          ],
        };
      },
    });

    const seasons = await api.getSeasons('../unsafe?query=true');

    assert.strictEqual(seasons.length, MAX_JELLYFIN_SEASONS - 1);
    assert.ok(!('providerOnly' in seasons[0]));
    assert.ok(!endpoint.includes('../'));
    assert.ok(!endpoint.includes('?query='));
  });
});
