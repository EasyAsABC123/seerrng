/** Ascending maturity order; values missing from a list are not rated. */
export const MOVIE_CERTIFICATIONS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
export const TV_CERTIFICATIONS = [
  'TV-Y',
  'TV-Y7',
  'TV-G',
  'TV-PG',
  'TV-14',
  'TV-MA',
];

export interface AgeGateSettings {
  /** Accounts without an explicit flag are restricted when true (admins exempt). */
  defaultRestricted: boolean;
  maxMovieCertification: string;
  maxTvCertification: string;
  certificationCountry: string;
}

export const DEFAULT_AGE_GATE_SETTINGS: AgeGateSettings = {
  defaultRestricted: false,
  maxMovieCertification: 'PG-13',
  maxTvCertification: 'TV-14',
  certificationCountry: 'US',
};
