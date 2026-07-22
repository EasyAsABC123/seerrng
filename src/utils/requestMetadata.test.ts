import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getRequestMetadataApiPath } from './requestMetadata';

const requestWithMedia = (
  type: string,
  media: Parameters<typeof getRequestMetadataApiPath>[0]['media']
) => ({ type, media });

describe('getRequestMetadataApiPath', () => {
  it('resolves a book after the individual request supplies its identifier', () => {
    const listRequest = requestWithMedia('book', {});
    const hydratedRequest = requestWithMedia('book', {
      identifiers: [
        {
          provider: 'openlibrary',
          value: '/works/OL21345941W',
        },
      ],
    });

    assert.equal(getRequestMetadataApiPath(listRequest), null);
    assert.equal(
      getRequestMetadataApiPath(hydratedRequest),
      '/api/v1/book/OL21345941W'
    );
  });

  it('preserves movie and music metadata paths', () => {
    assert.equal(
      getRequestMetadataApiPath(requestWithMedia('movie', { tmdbId: 1400357 })),
      '/api/v1/movie/1400357'
    );
    assert.equal(
      getRequestMetadataApiPath(
        requestWithMedia('music', { mbId: ' ABCD-1234 ' })
      ),
      '/api/v1/music/abcd-1234'
    );
  });
});
