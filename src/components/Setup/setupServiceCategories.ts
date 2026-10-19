import {
  DEFAULT_ENABLED_MEDIA_CATEGORIES,
  type EnabledMediaCategories,
} from '@server/constants/mediaCategories';

export const SETUP_SERVICE_CATEGORIES = [
  'tv-movies',
  'audiobooks-books',
  'music',
  'tools-other',
] as const;

export type SetupServiceCategory = (typeof SETUP_SERVICE_CATEGORIES)[number];

export const getSetupServiceCategories = (
  enabledMediaCategories?: EnabledMediaCategories
): SetupServiceCategory[] => {
  const enabled = enabledMediaCategories ?? DEFAULT_ENABLED_MEDIA_CATEGORIES;
  const categories: SetupServiceCategory[] = [];

  if (enabled.movie || enabled.tv || enabled.adult || enabled.sports) {
    categories.push('tv-movies');
  }
  if (enabled.ebook || enabled.audiobook || enabled.comic || enabled.magazine) {
    categories.push('audiobooks-books');
  }
  if (enabled.music) {
    categories.push('music');
  }
  if (Object.values(enabled).some(Boolean)) {
    categories.push('tools-other');
  }

  return categories;
};
