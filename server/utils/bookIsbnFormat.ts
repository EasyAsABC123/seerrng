import type { BookIsbnCandidate } from '@server/models/Book';

/** An absent Open Library format is not evidence of a digital edition. */
export const isbnCandidateSupportsFormat = (
  candidate: BookIsbnCandidate,
  format: 'ebook' | 'audiobook'
): boolean => {
  const label = candidate.format?.trim().toLowerCase() ?? '';
  const audio =
    /audio|sound recording|cassette|compact disc|\bmp3\b|\bcd\b/.test(label);
  if (format === 'audiobook') return audio;
  return (
    !audio && /e[ -]?book|epub|kindle|\bpdf\b|\bmobi\b|electronic/.test(label)
  );
};
