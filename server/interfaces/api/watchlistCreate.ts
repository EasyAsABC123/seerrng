import { MediaType } from '@server/constants/media';
import {
  isValidMusicBrainzResourceId,
  isValidOpenLibraryResourceId,
  normalizeMusicBrainzId,
  normalizeOpenLibraryWorkId,
} from '@server/lib/externalIds';
import { z } from 'zod';

const maxWatchlistId = 1_000_000_000;
const maxWatchlistTextLength = 512;

const strictPositiveInteger = z.preprocess(
  (value) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().positive().max(maxWatchlistId)
);

export const watchlistCreate = z.object({
  ratingKey: z.string().trim().min(1).max(maxWatchlistTextLength).optional(),
  tmdbId: strictPositiveInteger.optional(),
  mbId: z
    .string()
    .trim()
    .min(1)
    .max(maxWatchlistTextLength)
    .refine((value) =>
      isValidMusicBrainzResourceId(normalizeMusicBrainzId(value))
    )
    .optional(),
  externalId: z
    .string()
    .trim()
    .min(1)
    .max(maxWatchlistTextLength)
    .refine((value) =>
      isValidOpenLibraryResourceId(normalizeOpenLibraryWorkId(value))
    )
    .optional(),
  mediaType: z.nativeEnum(MediaType),
  title: z.string().trim().max(maxWatchlistTextLength).optional(),
});
