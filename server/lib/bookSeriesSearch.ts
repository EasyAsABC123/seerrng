import ReadarrAPI from '@server/api/servarr/readarr';
import { getRepository } from '@server/datasource';
import BookSeries from '@server/entity/BookSeries';
import type { User } from '@server/entity/User';
import { backendScope, clientFor } from '@server/lib/bookSeries';
import { resolveCatalogSeriesBooks } from '@server/lib/catalogSeriesBooks';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import type {
  BookSeriesPreview,
  BookSeriesSearchResponse,
  BookSeriesSearchResult,
  BookSeriesSearchVariant,
} from '@server/models/BookSeries';

/** Group display choices by explicit global provider identity, retaining every route. */
export const groupBookSeriesResults = (
  results: BookSeriesSearchVariant[]
): BookSeriesSearchResult[] => {
  const groups = new Map<string, BookSeriesSearchVariant[]>();
  for (const result of results) {
    // Titles and native numeric IDs are not globally unique series identities.
    const key =
      result.providerId && /^(?:hc|gr):[1-9]\d*$/.test(result.providerId)
        ? `provider:${result.providerId}`
        : result.key;
    const variants = groups.get(key) ?? [];
    if (!variants.some((variant) => variant.key === result.key))
      variants.push(result);
    groups.set(key, variants);
  }
  return [...groups].map(([key, variants]) => {
    const primary =
      variants.find((variant) => variant.source === 'catalog') ?? variants[0];
    const counts = new Set(
      variants
        .filter((variant) => variant.source === primary.source)
        .map((variant) => variant.bookCount)
    );
    return {
      ...primary,
      key,
      bookCount: counts.size === 1 ? primary.bookCount : undefined,
      variants,
    };
  });
};

export const searchBookSeries = async (
  query: string,
  format?: 'ebook' | 'audiobook'
): Promise<BookSeriesSearchResponse> => {
  const servers = getSettings().readarr.filter(
    (s) => !format || (s.serviceType ?? 'ebook') === format
  );
  const results: BookSeriesSearchResult[] = [];
  let failures = 0,
    supported = 0,
    truncated = false;
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  // Servers run sequentially; each inventory bounds native concurrency to five.
  for (const server of servers) {
    const client = clientFor(server);
    const scope = backendScope(server);
    try {
      const library = await client.getNativeSeriesLibrary();
      if (library.supported) supported++;
      if (library.partial) failures++;
      truncated ||= library.truncated;
      const matches = library.entries.filter(({ series }) =>
        words.every((word) => series.title.toLocaleLowerCase().includes(word))
      );
      truncated ||= matches.length > 100;
      for (const { series, authorId } of matches.slice(0, 100)) {
        const identity = { provider: scope, providerId: String(series.id) };
        const repository = getRepository(BookSeries);
        await repository.upsert(
          { ...identity, title: series.title, authorId },
          ['provider', 'providerId']
        );
        const local = await repository.findOneByOrFail(identity);
        results.push({
          key: `${scope}:local:${series.id}`,
          title: series.title,
          serverName: server.name,
          format: server.serviceType ?? 'ebook',
          source: 'library',
          providerId: series.foreignSeriesId ?? undefined,
          href: `/book-series/${local.id}`,
          bookCount: new Set(series.links.map((l) => l.bookId)).size,
        });
      }
    } catch {
      failures++;
    }
    try {
      const catalog = await client.searchSeriesCatalog(query);
      if (catalog === undefined) continue;
      supported++;
      const unique = [
        ...new Map(catalog.map((entry) => [entry.providerId, entry])).values(),
      ];
      truncated ||= unique.length > 100;
      for (const entry of unique.slice(0, 100)) {
        results.push({
          key: `${scope}:catalog:${entry.providerId}`,
          title: entry.title,
          serverName: server.name,
          format: server.serviceType ?? 'ebook',
          source: 'catalog',
          providerId: entry.providerId,
          href: `/book-series/catalog?serverId=${server.id}&scope=${encodeURIComponent(scope)}&providerId=${encodeURIComponent(entry.providerId)}`,
          description: entry.description,
          bookCount: entry.bookCount,
        });
      }
    } catch {
      failures++;
    }
  }
  results.sort(
    (a, b) =>
      (a.source === b.source ? 0 : a.source === 'catalog' ? -1 : 1) ||
      Number(b.title.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) -
        Number(
          a.title.toLocaleLowerCase() === query.trim().toLocaleLowerCase()
        ) ||
      a.title.localeCompare(b.title)
  );
  return {
    results: groupBookSeriesResults(results),
    truncated,
    status: !servers.length
      ? 'disabled'
      : failures
        ? supported
          ? 'partial'
          : 'unavailable'
        : supported
          ? 'ok'
          : 'unsupported',
  };
};

export const getBookSeriesPreview = async (
  serverId: number,
  scope: string,
  providerId: string,
  user?: User
): Promise<BookSeriesPreview | undefined> => {
  const server = getSettings().readarr.find(
    (s) => s.id === serverId && backendScope(s) === scope
  );
  if (!server) return undefined;
  const client = clientFor(server);
  const preview = await client.getSeriesCatalogPreview(providerId);
  if (!preview) return undefined;
  // This opens the existing native search flow, which owns adding catalog books.
  const path = `/add/search?term=${encodeURIComponent(preview.title)}`;
  let managementUrl = user?.hasPermission(Permission.MANAGE_REQUESTS)
    ? server.externalUrl
      ? `${server.externalUrl.replace(/\/$/, '')}${path}`
      : ReadarrAPI.buildUrl(server, path)
    : undefined;
  if (managementUrl) {
    try {
      const url = new URL(managementUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      )
        managementUrl = undefined;
    } catch {
      managementUrl = undefined;
    }
  }
  return {
    title: preview.title,
    description: preview.description ?? undefined,
    serverName: server.name,
    format: server.serviceType ?? 'ebook',
    bookCount: preview.workCount,
    managementUrl,
    ...(await resolveCatalogSeriesBooks(preview.books, client, user)),
  };
};
