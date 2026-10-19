import { normalizeValidIsbn } from '@server/lib/isbn';
import type { ParsedItem, ResolveMediaType } from './types';

const MAX_ITEMS = 40;
const MAX_ITEM_LENGTH = 200;

const ISBN_CANDIDATE = /\b(?:97[89][-\s]?)?(?:\d[-\s]?){9}[\dXx]\b/g;

/** Finds valid ISBNs anywhere in free text. */
export const findIsbns = (text: string): string[] => {
  const found = new Set<string>();
  for (const match of text.matchAll(ISBN_CANDIDATE)) {
    const isbn = normalizeValidIsbn(match[0].replace(/[-\s]/g, ''));
    if (isbn) found.add(isbn);
  }
  return [...found];
};

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export const findUrls = (text: string): string[] => [
  ...new Set(
    (text.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,;]+$/, ''))
  ),
];

const LIST_PREFIX = /^\s*(?:[-*•–—]|\d{1,3}[.)]|\[[ xX]?\])\s+/;
const BY_SEPARATOR = /\s+(?:by|—|–|-|\|)\s+/i;

const cleanTitle = (value: string) =>
  value
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Splits one line into a title, optional creator, and optional year. */
export const parseTitleLine = (line: string): ParsedItem | undefined => {
  let text = line.replace(LIST_PREFIX, '').trim();
  if (!text || text.length < 2) return undefined;
  text = text.slice(0, MAX_ITEM_LENGTH);

  let year: number | undefined;
  const yearMatch = text.match(/[([](\d{4})[)\]]\s*$/);
  if (yearMatch) {
    year = Number(yearMatch[1]);
    text = text.slice(0, yearMatch.index).trim();
  }

  let typeHint: ResolveMediaType | undefined;
  const hint = text.match(
    /\((movie|film|tv|series|show|book|novel|album|game|anime)\)\s*$/i
  );
  if (hint) {
    const word = hint[1].toLowerCase();
    typeHint =
      word === 'movie' || word === 'film'
        ? 'movie'
        : word === 'tv' || word === 'series' || word === 'show'
          ? 'tv'
          : word === 'book' || word === 'novel'
            ? 'book'
            : (word as ResolveMediaType);
    text = text.slice(0, hint.index).trim();
  }

  const byParts = text.split(BY_SEPARATOR);
  const query = cleanTitle(byParts[0]);
  const creator =
    byParts.length > 1 ? cleanTitle(byParts.slice(1).join(' ')) : undefined;
  if (!query) return undefined;
  return {
    query,
    creator: creator || undefined,
    year,
    typeHint,
    evidence: line.trim().slice(0, 120),
  };
};

/**
 * Turns a pasted message into items. Line-per-title lists are the common
 * case; a single line with commas or semicolons is split only when every
 * part looks like a short title.
 */
export const parseTextList = (text: string): ParsedItem[] => {
  const withoutUrls = text.replace(URL_PATTERN, ' ');
  let lines = withoutUrls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 1 && /[;,]/.test(lines[0])) {
    const parts = lines[0].split(/\s*[;,]\s*(?:and\s+)?/i).filter(Boolean);
    const words = (part: string) => part.trim().split(/\s+/).length;
    // A list, not a sentence: short parts, and a pair must be very short.
    const looksLikeList =
      parts.length >= 3
        ? parts.every((part) => part.length <= 80 && words(part) <= 8)
        : parts.length === 2 &&
          parts.every((part) => part.length <= 40 && words(part) <= 4);
    if (looksLikeList) {
      lines = parts;
    }
  }

  const items: ParsedItem[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const item = parseTitleLine(line);
    if (!item) continue;
    const key = `${item.query.toLowerCase()}|${item.creator?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
};

export interface LinkClassification {
  provider:
    | 'imdb'
    | 'tmdb'
    | 'letterboxd'
    | 'steam'
    | 'musicbrainz'
    | 'anilist'
    | 'goodreads'
    | 'hardcover'
    | 'openlibrary'
    | 'amazon'
    | 'audible'
    | 'music-stream'
    | 'generic';
  id?: string;
  type?: string;
}

const isHostOrSubdomain = (host: string, domain: string): boolean => {
  const hostLabels = host.split('.');
  const domainLabels = domain.split('.');
  if (hostLabels.length < domainLabels.length) return false;

  const hostDomainLabels = hostLabels.slice(-domainLabels.length);
  return domainLabels.every(
    (label, index) => hostDomainLabels[index] === label
  );
};

const isAmazonMarketplaceHost = (host: string): boolean =>
  /(^|\.)amazon\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host);

const isAudibleMarketplaceHost = (host: string): boolean =>
  /(^|\.)audible\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host);

export const classifyLink = (raw: string): LinkClassification => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { provider: 'generic' };
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|m)\./, '');
  const path = url.pathname;

  if (isHostOrSubdomain(host, 'imdb.com')) {
    const id = path.match(/\/title\/(tt\d{5,10})/)?.[1];
    return { provider: 'imdb', id };
  }
  if (host === 'themoviedb.org') {
    const match = path.match(/\/(movie|tv)\/(\d+)/);
    return { provider: 'tmdb', type: match?.[1], id: match?.[2] };
  }
  if (isHostOrSubdomain(host, 'letterboxd.com') || host === 'boxd.it') {
    return { provider: 'letterboxd' };
  }
  if (host === 'store.steampowered.com' || host === 'steamcommunity.com') {
    return { provider: 'steam', id: path.match(/\/app\/(\d+)/)?.[1] };
  }
  if (host === 'musicbrainz.org') {
    const match = path.match(
      /\/(release-group|release|artist)\/([0-9a-f-]{36})/i
    );
    return { provider: 'musicbrainz', type: match?.[1], id: match?.[2] };
  }
  if (host === 'anilist.co') {
    return {
      provider: 'anilist',
      id: path.match(/\/anime\/(\d+)/)?.[1],
      type: 'anime',
    };
  }
  if (isHostOrSubdomain(host, 'goodreads.com')) {
    return { provider: 'goodreads' };
  }
  if (host === 'hardcover.app') return { provider: 'hardcover' };
  if (host === 'openlibrary.org') {
    return {
      provider: 'openlibrary',
      id: path.match(/\/works\/(OL\d+W)/i)?.[1],
    };
  }
  if (isAmazonMarketplaceHost(host)) {
    return {
      provider: 'amazon',
      id: path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1],
    };
  }
  if (isAudibleMarketplaceHost(host)) {
    return {
      provider: 'audible',
      id: path.match(/\/pd\/[^/]+\/([A-Z0-9]{10})/)?.[1],
    };
  }
  if (
    /(^|\.)(open\.spotify\.com|music\.apple\.com|youtube\.com|youtu\.be|soundcloud\.com|bandcamp\.com|tidal\.com|deezer\.com)$/.test(
      host
    )
  ) {
    return { provider: 'music-stream' };
  }
  return { provider: 'generic' };
};
