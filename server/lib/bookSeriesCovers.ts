import { getRepository } from '@server/datasource';
import BookSeries from '@server/entity/BookSeries';
import { backendScope, clientFor } from '@server/lib/bookSeries';
import { getSettings } from '@server/lib/settings';
import { z } from 'zod';

export const seriesCoverTargetSchema = z.union([
  z.object({ seriesId: z.coerce.number().int().positive().safe() }).strict(),
  z
    .object({
      serverId: z.coerce.number().int().nonnegative().safe(),
      scope: z.string().min(1).max(256),
      providerId: z
        .string()
        .regex(/^hc:[1-9]\d*$/)
        .max(32),
    })
    .strict(),
]);
export type SeriesCoverTarget = z.infer<typeof seriesCoverTargetSchema>;
export const isSeriesCoverPath = (path: string) =>
  /^\/(?:MediaCoverProxy\/[a-f0-9]{32,128}\/[A-Za-z0-9_.-]+|MediaCover\/\d+\/(?:cover|poster)\.(?:jpg|jpeg|png|webp))$/i.test(
    path
  );

/** Lightweight backend metadata only: no per-book lookups or work matching. */
export async function getSeriesCoverBooks(target: SeriesCoverTarget) {
  const local =
    'seriesId' in target
      ? await getRepository(BookSeries).findOneBy({ id: target.seriesId })
      : undefined;
  if ('seriesId' in target && !local) return undefined;
  const server = getSettings().readarr.find((s) =>
    local
      ? backendScope(s) === local.provider
      : 'serverId' in target &&
        s.id === target.serverId &&
        backendScope(s) === target.scope
  );
  if (!server) return undefined;
  const client = clientFor(server);
  const series = local
    ? (await client.getSeriesByAuthor(local.authorId))?.find(
        (s) => String(s.id) === local.providerId
      )
    : 'providerId' in target
      ? await client.getSeriesCatalogPreview(target.providerId, false)
      : undefined;
  if (!series) return undefined;
  const books = [...(series.books ?? [])]
    .sort((a, b) =>
      (a.position ?? '').localeCompare(b.position ?? '', 'en', {
        numeric: true,
      })
    )
    .slice(0, 20)
    .map((book) => ({
      title: book.title,
      position: book.position ?? undefined,
      path: book.images?.find(
        (image) =>
          (!image.coverType ||
            ['cover', 'poster'].includes(image.coverType.toLowerCase())) &&
          isSeriesCoverPath(image.url)
      )?.url,
    }));
  return { client, books };
}
