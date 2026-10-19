import { describe, expect, it } from 'vitest';
import { getSetupServiceCategories } from './setupServiceCategories';

describe('getSetupServiceCategories', () => {
  it('keeps book setup focused while retaining shared acquisition tools', () => {
    expect(
      getSetupServiceCategories({
        movie: false,
        tv: false,
        music: false,
        ebook: true,
        audiobook: false,
        comic: false,
        magazine: false,
        adult: false,
        sports: false,
        retro: false,
        modern: false,
        game: false,
      })
    ).toEqual(['audiobooks-books', 'tools-other']);
  });

  it('shows no acquisition services when every request category is disabled', () => {
    expect(
      getSetupServiceCategories({
        movie: false,
        tv: false,
        music: false,
        ebook: false,
        audiobook: false,
        comic: false,
        magazine: false,
        adult: false,
        sports: false,
        retro: false,
        modern: false,
        game: false,
      })
    ).toEqual([]);
  });

  it('keeps the system group available for any enabled category', () => {
    expect(
      getSetupServiceCategories({
        movie: false,
        tv: false,
        music: false,
        ebook: false,
        audiobook: false,
        comic: false,
        magazine: false,
        adult: false,
        sports: false,
        retro: false,
        modern: true,
        game: false,
      })
    ).toEqual(['tools-other']);
  });
});
