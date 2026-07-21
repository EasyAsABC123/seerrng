export interface OptionalServiceAvailability {
  musicEnabled: boolean;
  booksEnabled: boolean;
}

export const isOptionalCatalogPathEnabled = (
  path: string,
  availability: OptionalServiceAvailability
): boolean =>
  path !== '/discover/music'
    ? path !== '/discover/books' || availability.booksEnabled
    : availability.musicEnabled;
