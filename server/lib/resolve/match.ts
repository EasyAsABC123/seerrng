import type { ResolveConfidence } from './types';

export const normalizeTitle = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokens = (value: string) =>
  new Set(normalizeTitle(value).split(' ').filter(Boolean));

/** Dice coefficient over word tokens; 1 for an exact normalised match. */
export const titleSimilarity = (a: string, b: string): number => {
  const left = tokens(a);
  const right = tokens(b);
  if (!left.size || !right.size) return 0;
  if (normalizeTitle(a) === normalizeTitle(b)) return 1;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return (2 * shared) / (left.size + right.size);
};

export const scoreCandidate = (
  input: { query: string; creator?: string; year?: number },
  candidate: { title: string; creator?: string; year?: number }
): number => {
  let score = titleSimilarity(input.query, candidate.title);
  if (input.creator && candidate.creator) {
    const creatorScore = titleSimilarity(input.creator, candidate.creator);
    score = score * 0.8 + creatorScore * 0.2;
  }
  if (input.year && candidate.year) {
    const distance = Math.abs(input.year - candidate.year);
    if (distance === 0) score = Math.min(1, score + 0.05);
    else if (distance > 2) score *= 0.9;
  }
  return Math.max(0, Math.min(1, score));
};

export const confidenceFor = (score: number): ResolveConfidence =>
  score >= 0.9 ? 'high' : score >= 0.6 ? 'moderate' : 'low';

/** Auto-select only when the best match clearly beats the runner-up. */
export const pickAutoSelected = (
  scores: number[],
  minimum = 0.9,
  margin = 0.15
): number | undefined => {
  if (!scores.length) return undefined;
  const best = scores.reduce((a, b, i) => (b > scores[a] ? i : a), 0);
  if (scores[best] < minimum) return undefined;
  const runnerUp =
    scores.filter((_, i) => i !== best).sort((a, b) => b - a)[0] ?? 0;
  return scores[best] - runnerUp >= margin ? best : undefined;
};
