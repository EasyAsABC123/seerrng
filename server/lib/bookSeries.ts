import OpenLibraryAPI, {
  type OpenLibrarySearchDoc,
} from '@server/api/openlibrary';
import ReadarrAPI, { type ReadarrSeries } from '@server/api/servarr/readarr';
import { getRepository } from '@server/datasource';
import BookSeries from '@server/entity/BookSeries';
import type Media from '@server/entity/Media';
import MediaIdentifier, {
  MediaIdentifierProvider,
} from '@server/entity/MediaIdentifier';
import type { User } from '@server/entity/User';
import {
  findBookMediaByOpenLibraryIds,
  findBookMediaForSearchDocs,
} from '@server/lib/bookMediaMatcher';
import { normalizeOpenLibraryWorkId } from '@server/lib/externalIds';
import { normalizeValidIsbn } from '@server/lib/isbn';
import { Permission } from '@server/lib/permissions';
import { getSettings, type ReadarrSettings } from '@server/lib/settings';
import { mapOpenLibrarySearchDoc } from '@server/models/Book';
import type {
  BookSeriesDetails,
  BookSeriesSummary,
  SeriesCatalogEntry,
} from '@server/models/BookSeries';
import { createHash } from 'node:crypto';

export const backendScope = (server: ReadarrSettings) =>
  `readarr:${server.id}:${createHash('sha256')
    .update(ReadarrAPI.buildUrl(server, '/api/v1'))
    .digest('hex')
    .slice(0, 16)}:${server.serviceType ?? 'ebook'}`;
export const clientFor = (server: ReadarrSettings) =>
  new ReadarrAPI({
    url: ReadarrAPI.buildUrl(server, '/api/v1'),
    apiKey: server.apiKey,
    mediaType: server.serviceType ?? 'ebook',
  });
const positionFor = (link: ReadarrSeries['links'][number]) =>
  link.position ??
  (link.seriesPosition !== undefined ? String(link.seriesPosition) : undefined);

export const findSeriesForBook = async (workId: string, user?: User) => {
  const servers = getSettings().readarr;
  if (!servers.length) return { status: 'disabled', series: [] };
  const media = (await findBookMediaByOpenLibraryIds([workId], user)).get(
    workId
  );
  if (!media) return { status: 'not-in-library', series: [] };
  const bindings = [
    {
      serverId: media.serviceId,
      bookId: media.externalServiceId,
      format: 'ebook',
    },
    {
      serverId: media.audiobookServiceId,
      bookId: media.audiobookExternalServiceId,
      format: 'audiobook',
    },
  ];
  const series: BookSeriesSummary[] = [];
  let failures = 0,
    supported = 0;
  for (const binding of bindings) {
    const server = servers.find(
      (candidate) =>
        candidate.id === binding.serverId &&
        (candidate.serviceType ?? 'ebook') === binding.format
    );
    if (!server || binding.bookId == null) continue;
    try {
      const client = clientFor(server);
      const book = await client.getNativeSeriesBook(binding.bookId);
      const authorId = book.authorId ?? book.author?.id;
      if (!authorId) continue;
      const catalog = await client.getSeriesByAuthor(authorId);
      if (!catalog) continue;
      supported++;
      for (const entry of catalog) {
        const membership = entry.links.find((link) => link.bookId === book.id);
        if (!membership) continue;
        // The author anchors a re-readable native catalog on Readarr-style servers.
        const identity = {
          provider: backendScope(server),
          providerId: String(entry.id),
        };
        const repository = getRepository(BookSeries);
        await repository.upsert({ ...identity, title: entry.title, authorId }, [
          'provider',
          'providerId',
        ]);
        const local = await repository.findOneByOrFail(identity);
        series.push({
          id: local.id,
          title: entry.title,
          position: positionFor(membership),
          serverName: server.name,
          format: server.serviceType ?? 'ebook',
        });
      }
    } catch {
      failures++;
    }
  }
  return {
    status: failures
      ? series.length
        ? 'partial'
        : 'unavailable'
      : supported
        ? 'matched'
        : 'unsupported',
    series,
  };
};

/** Only exact, unambiguous ISBN evidence enables a request. */
export const resolveSeriesBooks = async (isbns: string[]) => {
  const matches = new Map<string, Map<string, OpenLibrarySearchDoc>>();
  const library = new OpenLibraryAPI();
  for (let index = 0; index < isbns.length; index += 25) {
    const docs = await library.findWorksByIsbns(isbns.slice(index, index + 25));
    for (const doc of docs) {
      for (const isbn of doc.isbn ?? []) {
        const key = normalizeValidIsbn(isbn);
        if (!key) continue;
        if (!matches.has(key)) matches.set(key, new Map());
        matches.get(key)!.set(normalizeOpenLibraryWorkId(doc.key), doc);
      }
    }
  }
  return matches;
};

export const getSeriesDetails = async (
  id: number,
  user?: User
): Promise<BookSeriesDetails | undefined> => {
  const local = await getRepository(BookSeries).findOneBy({ id });
  if (!local) return undefined;
  const server = getSettings().readarr.find(
    (candidate) => backendScope(candidate) === local.provider
  );
  if (!server) return undefined;
  const authorId = local.authorId;
  const seriesId = Number(local.providerId);
  const client = clientFor(server);
  const catalog = (await client.getSeriesByAuthor(authorId))?.find(
    (entry) => entry.id === seriesId
  );
  if (!catalog) return undefined;
  const links = [
    ...new Map(catalog.links.map((link) => [link.bookId, link])).values(),
  ].sort((a, b) =>
    (positionFor(a) ?? '\uffff').localeCompare(
      positionFor(b) ?? '\uffff',
      'en',
      { numeric: true }
    )
  );
  const entries: SeriesCatalogEntry[] = [];
  // Bound native reads and retain an explicit warning when the catalog is larger.
  for (let offset = 0; offset < Math.min(links.length, 500); offset += 5) {
    const batch = await Promise.all(
      links.slice(offset, Math.min(offset + 5, 500)).map(async (link) => {
        const book = await client.getNativeSeriesBook(link.bookId, true);
        return {
          providerId: String(book.id),
          title: book.title,
          position: positionFor(link),
          primary: link.isPrimary,
          isbns: [
            ...new Set(
              (book.editions ?? [])
                .map((edition) =>
                  normalizeValidIsbn(edition.isbn13 ?? undefined)
                )
                .filter((value): value is string => !!value)
            ),
          ].slice(0, 25),
        };
      })
    );
    entries.push(...batch);
  }
  // Reuse canonical identities already established by library sync, including
  // books whose backend editions have no ISBN. Conflicting ISBN evidence still
  // makes a candidate ambiguous below.
  const format = server.serviceType ?? 'ebook';
  const serviceField = format === 'ebook' ? 'serviceId' : 'audiobookServiceId';
  const bookField =
    format === 'ebook' ? 'externalServiceId' : 'audiobookExternalServiceId';
  const known = entries.length
    ? await getRepository(MediaIdentifier)
        .createQueryBuilder('identifier')
        .innerJoinAndSelect('identifier.media', 'media')
        .where(
          'identifier.provider = :provider AND identifier.canonical = :canonical',
          {
            provider: MediaIdentifierProvider.OPENLIBRARY,
            canonical: true,
          }
        )
        .andWhere(`media.${serviceField} = :serverId`, { serverId: server.id })
        .andWhere(`media.${bookField} IN (:...ids)`, {
          ids: entries.map((entry) => Number(entry.providerId)),
        })
        .getMany()
    : [];
  const matches = await resolveSeriesBooks([
    ...new Set(entries.flatMap((entry) => entry.isbns)),
  ]);
  const candidates = entries.map((entry) => ({
    entry,
    matches: new Map([
      ...entry.isbns.flatMap((isbn) => [
        ...(matches.get(isbn)?.entries() ?? []),
      ]),
      ...known
        .filter(
          (identifier) =>
            String(identifier.media[bookField]) === entry.providerId
        )
        .map(
          (identifier) =>
            [
              identifier.value,
              {
                key: `/works/${identifier.value}`,
                title: entry.title,
                isbn: entry.isbns,
              },
            ] as [string, OpenLibrarySearchDoc]
        ),
    ]),
  }));
  const owners = new Map<string, Set<string>>();
  for (const candidate of candidates)
    for (const workId of candidate.matches.keys()) {
      if (!owners.has(workId)) owners.set(workId, new Set());
      owners.get(workId)!.add(candidate.entry.providerId);
    }
  const unique = (candidate: (typeof candidates)[number]) =>
    candidate.matches.size === 1 &&
    owners.get([...candidate.matches.keys()][0])?.size === 1;
  const docs = [
    ...new Map(
      candidates.flatMap((candidate) =>
        unique(candidate) ? [...candidate.matches.entries()] : []
      )
    ).values(),
  ];
  const media = new Map<string, Media>();
  for (let offset = 0; offset < docs.length; offset += 7) {
    for (const [key, value] of await findBookMediaForSearchDocs(
      docs.slice(offset, offset + 7),
      user
    ))
      media.set(key, value);
  }
  const managementPath = user?.hasPermission(Permission.MANAGE_REQUESTS)
    ? client.getSeriesManagementPath(seriesId)
    : undefined;
  let managementUrl = managementPath
    ? server.externalUrl
      ? `${server.externalUrl.replace(/\/$/, '')}${managementPath}`
      : ReadarrAPI.buildUrl(server, managementPath)
    : undefined;
  if (managementUrl) {
    try {
      const parsed = new URL(managementUrl);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        managementUrl = undefined;
    } catch {
      managementUrl = undefined;
    }
  }
  return {
    managementUrl,
    watchTarget:
      catalog.foreignSeriesId &&
      /^(hc|gr):[1-9]\d*$/.test(catalog.foreignSeriesId)
        ? {
            serverId: server.id,
            scope: backendScope(server),
            providerId: catalog.foreignSeriesId,
          }
        : undefined,
    id: local.id,
    title: catalog.title,
    description: catalog.description ?? undefined,
    serverName: server.name,
    format: server.serviceType ?? 'ebook',
    scope: 'backend-library',
    truncated: links.length > 500,
    entries: candidates.map((candidate) => {
      const doc = unique(candidate)
        ? [...candidate.matches.values()][0]
        : undefined;
      return {
        ...candidate.entry,
        matchStatus: doc
          ? 'matched'
          : candidate.matches.size
            ? 'ambiguous'
            : 'unmatched',
        book: doc
          ? mapOpenLibrarySearchDoc(
              doc,
              media.get(normalizeOpenLibraryWorkId(doc.key))
            )
          : undefined,
      };
    }),
  };
};
