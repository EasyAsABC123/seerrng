export type ResolveMediaType =
  'movie' | 'tv' | 'book' | 'album' | 'artist' | 'game' | 'anime';

export type ResolveConfidence = 'high' | 'moderate' | 'low';

export interface ResolveCandidate {
  mediaType: ResolveMediaType;
  /** Id used by the matching SeerrNG detail page. */
  id: string;
  title: string;
  creator?: string;
  year?: number;
  imageUrl?: string;
  /** Format the input implied (e.g. a paperback photo -> ebook/audiobook). */
  formatHint?: 'ebook' | 'audiobook';
  /** 0..1 similarity between the input and this candidate. */
  score: number;
  confidence: ResolveConfidence;
  /** Why this matched, shown to the person ("ISBN 978..."). */
  evidence: string;
  source: string;
  /** In-app route that opens the request flow for this candidate. */
  href: string;
}

/** One thing the person gave us, with the candidates that could be it. */
export interface ResolveGroup {
  /** Raw text, link, or ISBN this group came from. */
  input: string;
  inputKind: 'isbn' | 'url' | 'text' | 'image-text';
  /** Index of the pre-selected candidate when the match is unambiguous. */
  autoSelected?: number;
  candidates: ResolveCandidate[];
  /** Set when a link could not be read; the person can still search. */
  note?: 'unreadable-link' | 'blocked-link' | 'no-match' | 'song-link';
}

export interface ResolveRequest {
  text?: string;
  url?: string;
  isbn?: string;
  /** Narrow candidate searching to specific media types. */
  types?: ResolveMediaType[];
  /** Prefer this book format on candidates (format switching). */
  formatHint?: 'ebook' | 'audiobook';
  language?: string;
}

export interface ResolveResponse {
  groups: ResolveGroup[];
  /** True when image text was read by an external vision provider. */
  usedExternalProvider?: boolean;
}

export interface ParsedItem {
  query: string;
  creator?: string;
  year?: number;
  isbn?: string;
  typeHint?: ResolveMediaType;
  /** Provider ids found in a link, resolved without a title search. */
  direct?: { provider: string; id: string; type?: string };
  evidence: string;
}
