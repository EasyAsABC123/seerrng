import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cardFromCatalog,
  cardFromLookup,
  classifyAbridgement,
  classifyProduction,
  planSeriesWithNarrator,
} from '@server/lib/editionCompare';

describe('edition classification', () => {
  it('calls one narrator solo and many unknown unless the text says full cast', () => {
    assert.equal(classifyProduction(['Jim Dale']), 'solo');
    assert.equal(classifyProduction(['A', 'B']), 'unknown');
    assert.equal(
      classifyProduction(['A', 'B'], 'A Full-Cast Dramatization'),
      'full-cast'
    );
    assert.equal(
      classifyProduction(['1', '2', '3', '4', '5', '6']),
      'full-cast'
    );
  });

  it('reads abridgement only from the text', () => {
    assert.equal(classifyAbridgement('Dune (Unabridged)'), 'unabridged');
    assert.equal(classifyAbridgement('Dune (Abridged)'), 'abridged');
    assert.equal(classifyAbridgement('Dune'), 'unknown');
  });
});

describe('edition cards', () => {
  it('lists the details a catalog did not provide', () => {
    const card = cardFromLookup(
      { foreignEditionId: 'e1', title: 'Book', monitored: false },
      'audiobook'
    );
    assert.ok(card.unknownFields.includes('narrators'));
    assert.ok(card.unknownFields.includes('duration'));
    assert.equal(card.production, 'unknown');
  });

  it('keeps library state from the companion', () => {
    const card = cardFromCatalog(
      {
        editionId: 4,
        foreignEditionId: 'hc:4',
        title: 'Book',
        isEbook: false,
        narrators: ['Ray Porter'],
        production: 'solo',
        abridged: 'unabridged',
        durationSeconds: 3600,
        monitored: true,
        owned: true,
      },
      'audiobook'
    );
    assert.equal(card.selected, true);
    assert.equal(card.owned, true);
    assert.deepEqual(
      card.unknownFields.filter((f) => f !== 'language' && f !== 'releaseDate'),
      []
    );
  });
});

describe('series narrator plans', () => {
  it('shows coverage, gaps, and volumes only another narrator has', () => {
    const plans = planSeriesWithNarrator({
      seriesId: 1,
      seriesTitle: 'S',
      totalBooks: 3,
      narrators: [
        {
          name: 'A',
          production: 'solo',
          coveredBookIds: [1, 2],
          missingBookIds: [3],
          ownedBookIds: [1],
        },
        {
          name: 'B',
          production: 'solo',
          coveredBookIds: [3],
          missingBookIds: [1, 2],
          ownedBookIds: [],
        },
      ],
      books: [
        {
          bookId: 1,
          title: 'v1',
          narrators: [{ name: 'A', editionId: 1, owned: true }],
        },
        {
          bookId: 2,
          title: 'v2',
          narrators: [{ name: 'A', editionId: 2, owned: false }],
        },
        {
          bookId: 3,
          title: 'v3',
          narrators: [{ name: 'B', editionId: 3, owned: false }],
        },
      ],
    });
    assert.equal(plans[0].narrator, 'A');
    assert.equal(plans[0].complete, false);
    assert.deepEqual(plans[0].otherPerformanceOnly, [3]);
  });
});
