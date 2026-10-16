export const MOVIE_MATURITY_LIMITS = [
  'G',
  'PG',
  'PG-13',
  'R',
  'NC-17',
] as const;

export const TV_MATURITY_LIMITS = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
] as const;

export type MovieMaturityLimit = (typeof MOVIE_MATURITY_LIMITS)[number];
export type TvMaturityLimit = (typeof TV_MATURITY_LIMITS)[number];
