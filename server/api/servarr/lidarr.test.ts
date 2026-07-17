import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import LidarrAPI from './lidarr';

type MockableLidarr = {
  get: (endpoint: string) => Promise<unknown>;
};

afterEach(() => {
  mock.restoreAll();
});

describe('Lidarr response normalization', () => {
  it('returns exact metadata profile records', async () => {
    const api = new LidarrAPI({
      url: 'http://localhost:8686/api/v1',
      apiKey: 'key',
    });
    mock.method(
      LidarrAPI.prototype as unknown as MockableLidarr,
      'get',
      async () => [
        null,
        { id: 'bad', name: 'Invalid' },
        {
          id: 1,
          name: 'Standard',
          apiKey: 'provider-secret',
          providerOnly: true,
        },
      ]
    );

    const profiles = await api.getMetadataProfiles();

    assert.deepStrictEqual(profiles, [{ id: 1, name: 'Standard' }]);
  });
});
