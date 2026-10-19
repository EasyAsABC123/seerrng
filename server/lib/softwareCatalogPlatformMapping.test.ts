import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAutomaticCatalogPlatform,
  getCatalogPlatformCandidates,
} from './softwareCatalogPlatformMapping';

describe('software catalog platform mapping', () => {
  it('matches normalized system aliases to one unique catalog platform', () => {
    const platforms = [
      { id: 130, name: 'Nintendo Entertainment System' },
      { id: 6, name: 'PC (Microsoft Windows)' },
    ];

    assert.deepStrictEqual(
      getAutomaticCatalogPlatform(
        {
          slug: 'nes',
          name: 'Nintendo',
          aliases: ['Nintendo Entertainment System'],
        },
        platforms
      ),
      platforms[0]
    );
  });

  it('does not guess when aliases match multiple catalog IDs', () => {
    const platforms = [
      { id: 130, name: 'Nintendo' },
      { id: 100, name: 'Nintendo' },
    ];
    const system = { slug: 'nes', name: 'Nintendo', aliases: ['Nintendo'] };

    assert.equal(getCatalogPlatformCandidates(system, platforms).length, 2);
    assert.equal(getAutomaticCatalogPlatform(system, platforms), undefined);
  });

  it('treats repeated labels for one catalog ID as a single match', () => {
    const platforms = [
      { id: 130, name: 'Nintendo Entertainment System' },
      { id: 130, name: 'NES' },
    ];

    assert.deepStrictEqual(
      getAutomaticCatalogPlatform(
        {
          slug: 'nes',
          name: 'NES',
          aliases: ['Nintendo Entertainment System'],
        },
        platforms
      ),
      platforms[1]
    );
  });
});
