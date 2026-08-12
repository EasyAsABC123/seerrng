import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type MusicBrainz from '@server/api/musicbrainz';
import type {
  MbAlbumDetails,
  MbRecordingDetails,
} from '@server/api/musicbrainz/interfaces';
import type { SpotifyPlaylistItems } from '@server/api/spotify';
import type { YouTubePlaylistItems } from '@server/api/youtube';
import {
  parsePlaylistUrl,
  resolveSpotifyPlaylist,
  resolveYouTubePlaylist,
} from './playlist';

const album: MbAlbumDetails = {
  id: 'album-id',
  title: 'Discovery',
  score: 100,
  media_type: 'album',
  'primary-type': 'Album',
  'first-release-date': '2001-03-07',
  'artist-credit': [
    {
      name: 'Daft Punk',
      artist: {
        id: 'artist-id',
        name: 'Daft Punk',
        'sort-name': 'Daft Punk',
      },
    },
  ],
  posterPath: undefined,
  'type-id': '',
  'primary-type-id': '',
  count: 0,
  releases: [],
  releasedate: '2001-03-07',
};

const recording: MbRecordingDetails = {
  id: 'recording-id',
  title: 'Around the World',
  score: 100,
  media_type: 'recording',
  'artist-credit': [
    {
      name: 'Daft Punk',
      artist: {
        id: 'artist-id',
        name: 'Daft Punk',
        'sort-name': 'Daft Punk',
      },
    },
  ],
  'first-release-date': '1997-01-01',
  releases: [
    {
      id: 'release-id',
      title: 'Discovery',
      status: 'Official',
      'first-release-date': '2001-03-07',
      'release-group': {
        id: 'album-id',
        title: 'Discovery',
        'primary-type': 'Album',
        'secondary-types': [],
      },
    },
  ],
};

describe('playlist resolution', () => {
  it('recognizes only supported playlist URL forms', () => {
    assert.deepEqual(
      parsePlaylistUrl('https://open.spotify.com/playlist/abc123'),
      {
        provider: 'spotify',
        id: 'abc123',
        url: 'https://open.spotify.com/playlist/abc123',
      }
    );
    assert.deepEqual(
      parsePlaylistUrl('https://www.youtube.com/playlist?list=PL123456'),
      {
        provider: 'youtube',
        id: 'PL123456',
        url: 'https://www.youtube.com/playlist?list=PL123456',
      }
    );
    assert.equal(
      parsePlaylistUrl('https://example.com/playlist/abc123'),
      undefined
    );
  });

  it('deduplicates Spotify tracks from the same album', async () => {
    const playlist: SpotifyPlaylistItems = {
      name: 'Favourites',
      url: 'https://open.spotify.com/playlist/abc123',
      tracks: [
        {
          title: 'One More Time',
          artists: ['Daft Punk'],
          albumTitle: 'Discovery',
          albumReleaseDate: '2001-03-07',
        },
        {
          title: 'Digital Love',
          artists: ['Daft Punk'],
          albumTitle: 'Discovery',
          albumReleaseDate: '2001-03-07',
        },
      ],
    };
    const fakeMusicBrainz = {
      searchAlbum: async () => [album],
    } as unknown as MusicBrainz;

    const result = await resolveSpotifyPlaylist(playlist, fakeMusicBrainz);
    assert.equal(result.totalItems, 2);
    assert.equal(result.matchedItems, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, 'album-id');
    assert.equal(result.items[0].sourceTitle, 'One More Time');
  });

  it('resolves a YouTube recording to a requestable release group', async () => {
    const playlist: YouTubePlaylistItems = {
      name: 'Videos',
      url: 'https://www.youtube.com/playlist?list=PL123456',
      tracks: [
        {
          title: 'Daft Punk - Around the World (Official Video)',
          sourceUrl: 'https://www.youtube.com/watch?v=video',
        },
      ],
    };
    const fakeMusicBrainz = {
      searchRecording: async () => [recording],
    } as unknown as MusicBrainz;

    const result = await resolveYouTubePlaylist(playlist, fakeMusicBrainz);
    assert.equal(result.matchedItems, 1);
    assert.equal(result.items[0].id, 'album-id');
    assert.equal(result.items[0].title, 'Discovery');
  });
});
