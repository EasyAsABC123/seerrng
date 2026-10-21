import OpenLibraryAPI, {
  type OpenLibrarySearchDoc,
} from '@server/api/openlibrary';
import type ReadarrAPI from '@server/api/servarr/readarr';
import type Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import { findBookMediaForSearchDocs } from '@server/lib/bookMediaMatcher';
import { normalizeOpenLibraryWorkId } from '@server/lib/externalIds';
import { normalizeValidIsbn } from '@server/lib/isbn';
import { mapOpenLibrarySearchDoc } from '@server/models/Book';
import type { BookSeriesPreview } from '@server/models/BookSeries';

// Only typography/whitespace normalization: no fuzzy titles, subtitle stripping,
// author guessing, or popularity-based selection.
const sameMetadataText = (a: string, b: string) => {
  const normalize = (value: string) =>
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  return !!normalize(a) && normalize(a) === normalize(b);
};

export const resolveCatalogSeriesBooks = async (
  books: {
    foreignBookId: string;
    isbns?: string[] | null;
    identifiersComplete?: boolean | null;
    title: string;
    position?: string | null;
    authorName?: string | null;
  }[],
  client: Pick<ReadarrAPI, 'getCatalogBookIdentity'>,
  user?: User
): Promise<Pick<BookSeriesPreview, 'books' | 'resolutionTruncated'>> => {
  const library = new OpenLibraryAPI();
  const identities = new Map<
    string,
    { workIds: string[]; isbns: string[]; failed: boolean }
  >();
  const ids = [...new Set(books.map((book) => book.foreignBookId))];
  for (let offset = 0; offset < Math.min(ids.length, 100); offset += 5) {
    await Promise.all(
      ids.slice(offset, Math.min(offset + 5, 100)).map(async (id) => {
        try {
          const rows = books.filter((book) => book.foreignBookId === id);
          const supplied = rows.some(
            (book) => book.identifiersComplete != null
          );
          if (
            supplied &&
            rows.some(
              (book) => book.identifiersComplete !== true || !book.isbns
            )
          ) {
            throw new Error('Incomplete catalog identifier evidence.');
          }
          const identity = supplied
            ? { workIds: [], isbns: rows.flatMap((book) => book.isbns ?? []) }
            : await client.getCatalogBookIdentity(id);
          const workIds = (identity?.workIds ?? []).map(
            normalizeOpenLibraryWorkId
          );
          if (workIds.some((workId) => !/^OL[1-9]\d*W$/.test(workId)))
            throw new Error('Invalid work identity.');
          identities.set(id, {
            workIds,
            isbns: [
              ...new Set(
                (identity?.isbns ?? [])
                  .map(normalizeValidIsbn)
                  .filter((isbn): isbn is string => !!isbn)
              ),
            ],
            failed: workIds.length > 10,
          });
        } catch {
          identities.set(id, { workIds: [], isbns: [], failed: true });
        }
      })
    );
  }
  const isbnMatches = new Map<string, Map<string, OpenLibrarySearchDoc>>();
  const failedIsbns = new Set<string>();
  const isbns = [...new Set([...identities.values()].flatMap((i) => i.isbns))];
  // Never silently discard evidence: overly large sets leave those books unresolved.
  for (const identity of identities.values())
    if (identity.isbns.length > 200) identity.failed = true;
  const boundedIsbns = isbns.filter((isbn) =>
    [...identities.values()].some((i) => !i.failed && i.isbns.includes(isbn))
  );
  if (boundedIsbns.length > 2500)
    for (const isbn of boundedIsbns.slice(2500)) failedIsbns.add(isbn);
  for (
    let offset = 0;
    offset < Math.min(boundedIsbns.length, 2500);
    offset += 25
  ) {
    const batch = boundedIsbns.slice(offset, offset + 25);
    try {
      const docs = await library.findWorksByIsbns(batch);
      for (const doc of docs) {
        const workId = normalizeOpenLibraryWorkId(doc.key);
        if (!/^OL[1-9]\d*W$/.test(workId))
          throw new Error('Invalid matched work.');
        for (const raw of doc.isbn ?? []) {
          const isbn = normalizeValidIsbn(raw);
          if (!isbn || !batch.includes(isbn)) continue;
          if (!isbnMatches.has(isbn)) isbnMatches.set(isbn, new Map());
          isbnMatches.get(isbn)!.set(workId, doc);
        }
      }
    } catch {
      for (const isbn of batch) failedIsbns.add(isbn);
    }
  }
  const explicit = new Map<string, OpenLibrarySearchDoc>();
  const failedWorks = new Set<string>();
  const workIds = [
    ...new Set(
      [...identities.values()]
        .filter((i) => !i.failed)
        .flatMap((i) => i.workIds)
    ),
  ];
  for (let offset = 0; offset < workIds.length; offset += 5) {
    await Promise.all(
      workIds.slice(offset, offset + 5).map(async (workId) => {
        try {
          const work = await library.getWork(workId);
          if (normalizeOpenLibraryWorkId(work.key) !== workId)
            throw new Error('Wrong work response.');
          explicit.set(workId, {
            key: work.key,
            title: work.title,
            cover_i: work.covers?.find((id) => id > 0),
          });
        } catch {
          failedWorks.add(workId);
        }
      })
    );
  }
  const candidates = books.map((book) => {
    const identity = identities.get(book.foreignBookId);
    const matches = new Map<string, OpenLibrarySearchDoc>();
    for (const id of identity?.workIds ?? [])
      if (explicit.has(id)) matches.set(id, explicit.get(id)!);
    for (const isbn of identity?.isbns ?? [])
      for (const [id, doc] of isbnMatches.get(isbn) ?? []) matches.set(id, doc);
    // A provider's edition set can include a box set or split-volume ISBNs.
    // Resolve that conflict only when one ISBN-backed candidate also agrees on
    // the full work title and an explicitly named author. Explicit work-ID
    // conflicts remain blocked. Retain all candidates for cross-book collisions.
    const sameTitle = [...matches.entries()].filter(([, doc]) =>
      sameMetadataText(book.title, doc.title)
    );
    const agreedId =
      identity?.workIds.length === 0 &&
      [...matches.values()].every((doc) => doc.title.trim()) &&
      sameTitle.length === 1 &&
      book.authorName &&
      sameTitle[0][1].author_name?.some((author) =>
        sameMetadataText(book.authorName!, author)
      )
        ? sameTitle[0][0]
        : undefined;
    const exclusiveIsbns = (identity?.isbns ?? []).filter(
      (isbn) =>
        agreedId &&
        isbnMatches.get(isbn)?.size === 1 &&
        isbnMatches.get(isbn)?.has(agreedId)
    );
    const resolvedId =
      matches.size === 1
        ? [...matches.keys()][0]
        : exclusiveIsbns.length
          ? agreedId
          : undefined;
    // Downstream acquisition must receive an ISBN exclusive to the chosen work,
    // never the contaminated ISBN that also identifies another candidate.
    if (matches.size > 1 && resolvedId) {
      matches.set(resolvedId, {
        ...matches.get(resolvedId)!,
        isbn: exclusiveIsbns,
      });
    }
    return {
      source: book,
      matches,
      resolvedId,
      failed:
        !identity ||
        identity.failed ||
        identity.workIds.some((id) => failedWorks.has(id)) ||
        identity.isbns.some((isbn) => failedIsbns.has(isbn)),
    };
  });
  const owners = new Map<string, Set<string>>();
  for (const candidate of candidates)
    for (const id of candidate.matches.keys()) {
      if (!owners.has(id)) owners.set(id, new Set());
      owners.get(id)!.add(candidate.source.foreignBookId);
    }
  const unique = (candidate: (typeof candidates)[number]) =>
    !candidate.failed &&
    candidate.resolvedId !== undefined &&
    owners.get(candidate.resolvedId)?.size === 1;
  const docs = [
    ...new Map(
      candidates.flatMap((c) =>
        unique(c)
          ? [[c.resolvedId!, c.matches.get(c.resolvedId!)!] as const]
          : []
      )
    ).values(),
  ];
  const media = new Map<string, Media>();
  for (let offset = 0; offset < docs.length; offset += 7) {
    for (const [id, item] of await findBookMediaForSearchDocs(
      docs.slice(offset, offset + 7),
      user
    ))
      media.set(id, item);
  }
  return {
    resolutionTruncated: ids.length > 100,
    books: candidates.map((candidate) => {
      const doc = unique(candidate)
        ? candidate.matches.get(candidate.resolvedId!)
        : undefined;
      return {
        title: candidate.source.title,
        position: candidate.source.position ?? undefined,
        author: candidate.source.authorName ?? undefined,
        matchStatus: candidate.failed
          ? 'unavailable'
          : doc
            ? 'matched'
            : candidate.matches.size
              ? 'ambiguous'
              : 'unmatched',
        book: doc
          ? {
              ...mapOpenLibrarySearchDoc(
                doc,
                media.get(normalizeOpenLibraryWorkId(doc.key))
              ),
              author: candidate.source.authorName ?? doc.author_name?.[0],
            }
          : undefined,
      };
    }),
  };
};
