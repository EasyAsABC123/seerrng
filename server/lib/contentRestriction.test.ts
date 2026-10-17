import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterRestrictedPayload,
  isContentRestricted,
  type ContentRestriction,
} from './contentRestriction';
import { Permission } from './permissions';

const restriction: ContentRestriction = {
  maxMovieCertification: 'PG-13',
  maxTvCertification: 'TV-14',
  certificationCountry: 'US',
};

const user = (contentRestricted?: boolean | null, permissions = 0) => ({
  contentRestricted,
  permissions,
  hasPermission: (p: number) => (permissions & p) !== 0,
});

test('explicit flag decides restriction, admins exempt only by default', () => {
  assert.equal(isContentRestricted(user(true, Permission.ADMIN)), true);
  assert.equal(isContentRestricted(user(false)), false);
  assert.equal(isContentRestricted(undefined), false);
});

test('filters adult, explicit, over-ceiling, and tagged items from lists', () => {
  const { payload, blocked } = filterRestrictedPayload(restriction, {
    page: 1,
    results: [
      { id: 1, title: 'ok' },
      { id: 2, adult: true },
      { id: 3, explicit: true },
      { id: 4, mediaType: 'adult' },
      { id: 8, media: { mediaType: 'adult' } },
      { id: 5, genres: [{ id: 1, name: 'Erotica' }] },
      { id: 6, subjects: ['Cooking'] },
      { id: 7, certification: 'NC-17' },
    ],
  });
  assert.equal(blocked, false);
  assert.deepEqual(
    (payload as { results: { id: number }[] }).results.map((r) => r.id),
    [1, 6]
  );
});

test('blocks detail records whose rating exceeds the ceiling', () => {
  const movie = {
    id: 9,
    releases: {
      results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'R' }] }],
    },
  };
  assert.equal(filterRestrictedPayload(restriction, movie).blocked, true);

  const tv = {
    id: 10,
    contentRatings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
  };
  assert.equal(filterRestrictedPayload(restriction, tv).blocked, true);

  const fine = {
    id: 11,
    releases: {
      results: [{ iso_3166_1: 'US', release_dates: [{ certification: 'PG' }] }],
    },
  };
  assert.equal(filterRestrictedPayload(restriction, fine).blocked, false);
});

test('unrated items are allowed (best-effort)', () => {
  assert.equal(
    filterRestrictedPayload(restriction, { id: 1, certification: 'NR' })
      .blocked,
    false
  );
});
