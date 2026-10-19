import type { ReadarrSettings } from '@server/lib/settings';
import { readarrServiceSupportsFormat } from '@server/utils/readarrService';
import {
  createSafeHttpUrl,
  stringifySafeHttpUrl,
} from '@server/utils/security';
import { buildServiceUrl } from '@server/utils/serviceUrl';
import axios, { type AxiosRequestConfig, type Method } from 'axios';

export type BinderyMediaType = 'ebook' | 'audiobook' | 'both';

export interface BinderySystemStatus {
  version?: string;
  commit?: string;
  buildDate?: string;
  features?: Record<string, unknown>;
  capabilities?: Record<string, unknown> | string[];
  [key: string]: unknown;
}

export interface BinderyBook {
  id?: number;
  foreignBookId: string;
  foreignAuthorId?: string;
  title: string;
  titleSlug?: string;
  authorName?: string;
  mediaType?: BinderyMediaType;
  monitored?: boolean;
  status?: string;
  formats?: string[];
  isbns?: string[];
  isbn?: string;
  asin?: string;
  statistics?: {
    ebookFileCount?: number;
    audiobookFileCount?: number;
    bookFileCount?: number;
  };
  author?: { foreignAuthorId?: string; name?: string; authorName?: string };
}

export type BinderyLibraryBook = BinderyBook & { id: number };

export interface BinderyBookPage {
  items: BinderyBook[];
  total: number;
  limit: number;
  offset: number;
}

export interface BinderyUser {
  id: number;
  username: string;
  email?: string;
}

export interface BinderyCreatedRequest {
  id: number;
  kind: 'book';
  foreignId: string;
  mediaType: BinderyMediaType;
  status: 'pending' | 'approved' | 'declined';
  fulfilled?: boolean;
  resultBookId?: number;
}

export interface BinderyAddBookOptions {
  foreignBookId: string;
  foreignAuthorId?: string;
  authorName?: string;
  mediaType: BinderyMediaType;
  searchOnAdd: boolean;
}

const MAX_BINDERY_RESPONSE_BYTES = 16 * 1024 * 1024;
export const MAX_BINDERY_LIBRARY_RESULTS = 5_000;
export const BINDERY_LIBRARY_PAGE_SIZE = 100;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const parseBook = (
  value: unknown,
  allowProviderResult = false
): BinderyBook | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    (value.id === undefined
      ? !allowProviderResult
      : !Number.isSafeInteger(value.id) ||
        Number(value.id) < (allowProviderResult ? 0 : 1)) ||
    typeof value.foreignBookId !== 'string' ||
    !value.foreignBookId.trim() ||
    typeof value.title !== 'string' ||
    !value.title.trim()
  ) {
    return undefined;
  }

  const statistics = isRecord(value.statistics) ? value.statistics : undefined;
  const mediaType =
    value.mediaType === 'ebook' ||
    value.mediaType === 'audiobook' ||
    value.mediaType === 'both'
      ? value.mediaType
      : undefined;

  return {
    ...(Number.isSafeInteger(value.id) ? { id: Number(value.id) } : {}),
    foreignBookId: value.foreignBookId,
    ...(typeof value.foreignAuthorId === 'string'
      ? { foreignAuthorId: value.foreignAuthorId }
      : {}),
    title: value.title,
    ...(typeof value.titleSlug === 'string'
      ? { titleSlug: value.titleSlug }
      : {}),
    ...(typeof value.authorName === 'string'
      ? { authorName: value.authorName }
      : {}),
    ...(mediaType ? { mediaType } : {}),
    ...(typeof value.monitored === 'boolean'
      ? { monitored: value.monitored }
      : {}),
    ...(typeof value.status === 'string' ? { status: value.status } : {}),
    ...(Array.isArray(value.formats)
      ? {
          formats: value.formats.filter(
            (format): format is string => typeof format === 'string'
          ),
        }
      : {}),
    ...(Array.isArray(value.isbns)
      ? {
          isbns: value.isbns.filter(
            (isbn): isbn is string => typeof isbn === 'string'
          ),
        }
      : {}),
    ...(typeof value.isbn === 'string' ? { isbn: value.isbn } : {}),
    ...(typeof value.asin === 'string' ? { asin: value.asin } : {}),
    ...(statistics
      ? {
          statistics: {
            ...(Number.isSafeInteger(statistics.ebookFileCount)
              ? { ebookFileCount: Number(statistics.ebookFileCount) }
              : {}),
            ...(Number.isSafeInteger(statistics.audiobookFileCount)
              ? { audiobookFileCount: Number(statistics.audiobookFileCount) }
              : {}),
            ...(Number.isSafeInteger(statistics.bookFileCount)
              ? { bookFileCount: Number(statistics.bookFileCount) }
              : {}),
          },
        }
      : {}),
    ...(isRecord(value.author)
      ? {
          author: {
            ...(typeof value.author.foreignAuthorId === 'string'
              ? { foreignAuthorId: value.author.foreignAuthorId }
              : {}),
            ...(typeof value.author.name === 'string'
              ? { name: value.author.name }
              : {}),
            ...(typeof value.author.authorName === 'string'
              ? { authorName: value.author.authorName }
              : {}),
          },
        }
      : {}),
  };
};

const statusSupportsForUserRequests = (
  status: BinderySystemStatus
): boolean => {
  const featureNames = ['requestsForUser', 'forUserRequests'];
  const features = isRecord(status.features) ? status.features : undefined;
  const capabilityRecord = isRecord(status.capabilities)
    ? status.capabilities
    : undefined;
  const capabilityList = Array.isArray(status.capabilities)
    ? status.capabilities
    : [];

  return (
    featureNames.some((name) => features?.[name] === true) ||
    featureNames.some((name) => capabilityRecord?.[name] === true) ||
    capabilityList.some((name) =>
      ['requests.forUser', 'requestsForUser', 'forUserRequests'].includes(
        String(name)
      )
    )
  );
};

export default class BinderyAPI {
  private readonly root: string;

  constructor(private readonly settings: ReadarrSettings) {
    if (settings.backend !== 'bindery') {
      throw new Error('Bindery API requires a Bindery service connection.');
    }

    this.root = buildServiceUrl({
      useSsl: settings.useSsl,
      hostname: settings.hostname,
      port: settings.port,
      urlBase: settings.baseUrl,
      path: '/api/v1',
    });
  }

  private async request<T>(
    method: Method,
    path: string,
    data?: unknown,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    const safeUrl = await createSafeHttpUrl(`${this.root}${path}`, {
      allowPrivateAddresses: true,
    });
    if (!safeUrl) {
      throw new Error('Bindery service URL is invalid.');
    }

    const config: AxiosRequestConfig = {
      method,
      url: stringifySafeHttpUrl(safeUrl),
      headers: { 'X-Api-Key': this.settings.apiKey },
      ...(data === undefined ? {} : { data }),
      ...(params ? { params } : {}),
      timeout: 15_000,
      maxContentLength: MAX_BINDERY_RESPONSE_BYTES,
      maxBodyLength: MAX_BINDERY_RESPONSE_BYTES,
      maxRedirects: 0,
    };

    const response = await axios.request<T>(config);
    return response.data;
  }

  public async getSystemStatus(): Promise<BinderySystemStatus> {
    const status = await this.request<unknown>('GET', '/system/status');
    if (!isRecord(status)) {
      throw new Error('Bindery returned an invalid system status response.');
    }

    return status as BinderySystemStatus;
  }

  public async getPrimaryMetadataProvider(): Promise<string | undefined> {
    const result = await this.request<unknown>(
      'GET',
      '/setting/metadata.primary_provider'
    );
    if (!isRecord(result) || typeof result.value !== 'string') return undefined;
    return result.value.trim().toLowerCase() || undefined;
  }

  public supportsForUserRequests(status: BinderySystemStatus): boolean {
    return statusSupportsForUserRequests(status);
  }

  public async lookupBookByIsbn(
    isbn: string
  ): Promise<BinderyBook | undefined> {
    try {
      const result = await this.request<unknown>(
        'GET',
        '/book/lookup',
        undefined,
        {
          isbn,
        }
      );
      return parseBook(result, true);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  public async searchBooks(term: string): Promise<BinderyBook[]> {
    const results = await this.request<unknown>(
      'GET',
      '/search/book',
      undefined,
      {
        term,
      }
    );
    if (!Array.isArray(results)) {
      throw new Error('Bindery returned an invalid book search response.');
    }
    return results.slice(0, 100).flatMap((result) => {
      const parsed = parseBook(result, true);
      return parsed ? [parsed] : [];
    });
  }

  public async getUsers(): Promise<BinderyUser[]> {
    const result = await this.request<unknown>('GET', '/auth/users');
    const rows = Array.isArray(result)
      ? result
      : isRecord(result) && Array.isArray(result.users)
        ? result.users
        : undefined;
    if (!rows) throw new Error('Bindery returned an invalid users response.');

    return rows.slice(0, 1_000).flatMap((row) => {
      if (
        !isRecord(row) ||
        !Number.isSafeInteger(row.id) ||
        Number(row.id) < 1 ||
        typeof row.username !== 'string' ||
        !row.username.trim()
      ) {
        return [];
      }
      return [
        {
          id: Number(row.id),
          username: row.username,
          ...(typeof row.email === 'string' ? { email: row.email } : {}),
        },
      ];
    });
  }

  public async searchBookByIsbn(
    isbn: string
  ): Promise<BinderyBook | undefined> {
    return this.lookupBookByIsbn(isbn);
  }

  public async addBook(
    options: BinderyAddBookOptions
  ): Promise<BinderyLibraryBook> {
    const result = await this.request<unknown>('POST', '/author/book', options);
    const book = parseBook(result);
    if (!book?.id)
      throw new Error('Bindery returned an invalid added-book response.');
    return book as BinderyLibraryBook;
  }

  public async createUserRequest(
    options: BinderyAddBookOptions,
    forUser: number
  ): Promise<BinderyCreatedRequest> {
    const result = await this.request<unknown>('POST', '/requests', {
      kind: 'book',
      foreignId: options.foreignBookId,
      mediaType: options.mediaType,
      forUser,
    });
    if (
      !isRecord(result) ||
      !Number.isSafeInteger(result.id) ||
      Number(result.id) < 1 ||
      result.kind !== 'book' ||
      typeof result.foreignId !== 'string' ||
      result.foreignId !== options.foreignBookId ||
      result.mediaType !== options.mediaType ||
      (result.status !== 'pending' &&
        result.status !== 'approved' &&
        result.status !== 'declined')
    ) {
      throw new Error('Bindery returned an invalid request response.');
    }
    return {
      id: Number(result.id),
      kind: 'book',
      foreignId: result.foreignId,
      mediaType: options.mediaType,
      status: result.status,
      ...(typeof result.fulfilled === 'boolean'
        ? { fulfilled: result.fulfilled }
        : {}),
      ...(Number.isSafeInteger(result.resultBookId)
        ? { resultBookId: Number(result.resultBookId) }
        : {}),
    };
  }

  public async getImportedBooks(
    serviceType: 'ebook' | 'audiobook'
  ): Promise<BinderyLibraryBook[]> {
    if (!readarrServiceSupportsFormat(this.settings, serviceType)) {
      throw new Error(`Bindery service is not configured for ${serviceType}.`);
    }

    const items: BinderyLibraryBook[] = [];
    const seenIds = new Set<number>();
    let total: number | undefined;

    for (let offset = 0; ; offset += BINDERY_LIBRARY_PAGE_SIZE) {
      const page = await this.request<unknown>('GET', '/book', undefined, {
        status: 'imported',
        mediaType: serviceType,
        limit: BINDERY_LIBRARY_PAGE_SIZE,
        offset,
      });
      if (!isRecord(page) || !Array.isArray(page.items)) {
        throw new Error('Bindery returned an invalid library page.');
      }

      const pageTotal = page.total;
      if (
        !Number.isSafeInteger(pageTotal) ||
        Number(pageTotal) < 0 ||
        page.limit !== BINDERY_LIBRARY_PAGE_SIZE ||
        page.offset !== offset ||
        page.items.length > BINDERY_LIBRARY_PAGE_SIZE
      ) {
        throw new Error('Bindery returned inconsistent library pagination.');
      }
      total ??= Number(pageTotal);
      if (total !== Number(pageTotal) || total > MAX_BINDERY_LIBRARY_RESULTS) {
        throw new Error('Bindery library exceeded the safe scan limit.');
      }

      for (const row of page.items) {
        const book = parseBook(row);
        if (!book?.id || seenIds.has(book.id)) {
          throw new Error(
            'Bindery returned an invalid or repeated library row.'
          );
        }
        seenIds.add(book.id);
        items.push(book as BinderyLibraryBook);
      }

      if (items.length >= total) break;
      if (page.items.length === 0) {
        throw new Error('Bindery returned an incomplete library scan.');
      }
    }

    return items;
  }
}
