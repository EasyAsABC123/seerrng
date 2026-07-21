import ExternalAPI from '@server/api/externalapi';
import { getRepository } from '@server/datasource';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import cacheManager from '@server/lib/cache';
import {
  isValidMusicBrainzResourceId,
  normalizeMusicBrainzId,
  prepareMusicBrainzBatchIds,
} from '@server/lib/externalIds';
import logger from '@server/logger';
import { mapWithConcurrency } from '@server/utils/concurrency';
import { In } from 'typeorm';
import type { CoverArtResponse } from './interfaces';

const MAX_COVER_ART_IMAGES = 100;
const MAX_COVER_ART_IDENTIFIER_LENGTH = 256;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const boundedIdentifier = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const identifier = value.slice(0, MAX_COVER_ART_IDENTIFIER_LENGTH);
  return identifier ? identifier : undefined;
};

class CoverArtArchive extends ExternalAPI {
  private readonly CACHE_TTL = 43200;
  private readonly STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;
  static readonly BATCH_FETCH_CONCURRENCY = 5;

  constructor() {
    super(
      'https://coverartarchive.org',
      {},
      {
        nodeCache: cacheManager.getCache('coverartarchive').data,
        rateLimit: {
          maxRequests: 20,
          maxRPS: 50,
        },
      }
    );
  }

  private isMetadataStale(metadata: MetadataAlbum | null): boolean {
    if (!metadata) return true;
    return Date.now() - metadata.updatedAt.getTime() > this.STALE_THRESHOLD;
  }

  private createEmptyResponse(id: string): CoverArtResponse {
    return { images: [], release: `/release/${id}` };
  }

  private createCachedResponse(url: string, id: string): CoverArtResponse {
    return {
      images: [
        {
          approved: true,
          front: true,
          id: 0,
          thumbnails: { 250: url },
        },
      ],
      release: `/release/${id}`,
    };
  }

  public async getCoverArtFromCache(
    id: string
  ): Promise<string | null | undefined> {
    const albumId = normalizeMusicBrainzId(id);

    try {
      const metadata = await getRepository(MetadataAlbum).findOne({
        where: { mbAlbumId: albumId },
        select: ['caaUrl'],
      });
      return metadata?.caaUrl;
    } catch (error) {
      logger.error('Failed to fetch cover art from cache', {
        label: 'CoverArtArchive',
        id: albumId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async getCoverArt(id: string): Promise<CoverArtResponse> {
    const albumId = normalizeMusicBrainzId(id);

    try {
      const metadata = await getRepository(MetadataAlbum).findOne({
        where: { mbAlbumId: albumId },
        select: ['caaUrl', 'updatedAt'],
      });

      if (metadata?.caaUrl) {
        return this.createCachedResponse(metadata.caaUrl, albumId);
      }

      if (metadata && !this.isMetadataStale(metadata)) {
        return this.createEmptyResponse(albumId);
      }

      return await this.fetchCoverArt(albumId);
    } catch (error) {
      logger.error('Failed to get cover art', {
        label: 'CoverArtArchive',
        id: albumId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyResponse(albumId);
    }
  }

  private async fetchCoverArt(id: string): Promise<CoverArtResponse> {
    const albumId = normalizeMusicBrainzId(id);

    if (!isValidMusicBrainzResourceId(albumId)) {
      return this.createEmptyResponse(albumId);
    }

    try {
      const rawData = await this.get<unknown>(
        `/release-group/${encodeURIComponent(albumId)}`,
        undefined,
        this.CACHE_TTL
      );

      if (!isRecord(rawData)) {
        throw new Error('Invalid Cover Art Archive response');
      }

      const release =
        typeof rawData.release === 'string'
          ? rawData.release.slice(0, MAX_COVER_ART_IDENTIFIER_LENGTH)
          : `/release/${albumId}`;

      const releaseMBID = encodeURIComponent(
        release.split('/').filter(Boolean).pop() ?? albumId
      );
      const images = (Array.isArray(rawData.images) ? rawData.images : [])
        .slice(0, MAX_COVER_ART_IMAGES)
        .flatMap((value) => {
          if (!isRecord(value)) {
            return [];
          }

          const id = boundedIdentifier(value.id);
          if (id === undefined) {
            return [];
          }

          const imageId = encodeURIComponent(String(id));
          const fullUrl = `https://archive.org/download/mbid-${releaseMBID}/mbid-${releaseMBID}-${imageId}_thumb250.jpg`;

          return [
            {
              approved: value.approved === true,
              front: value.front === true,
              id,
              thumbnails: { 250: fullUrl },
            },
          ];
        });
      const data: CoverArtResponse = { images, release };

      const frontImage = data.images.find((image) => image.front);
      if (frontImage) {
        await getRepository(MetadataAlbum)
          .upsert(
            {
              mbAlbumId: albumId,
              caaUrl: frontImage.thumbnails[250],
            },
            { conflictPaths: ['mbAlbumId'] }
          )
          .catch((e) => {
            logger.error('Failed to save album metadata', {
              label: 'CoverArtArchive',
              error: e instanceof Error ? e.message : 'Unknown error',
            });
          });
      }

      return data;
    } catch {
      await getRepository(MetadataAlbum).upsert(
        { mbAlbumId: albumId, caaUrl: null },
        { conflictPaths: ['mbAlbumId'] }
      );
      return this.createEmptyResponse(albumId);
    }
  }

  public async batchGetCoverArt(
    ids: string[]
  ): Promise<Record<string, string | null>> {
    if (!ids.length) return {};

    const validIds = prepareMusicBrainzBatchIds(ids).filter(
      (id) =>
        typeof id === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          id
        )
    );

    if (!validIds.length) return {};

    const resultsMap = new Map<string, string | null>();
    const idsToFetch: string[] = [];

    const metadataRepository = getRepository(MetadataAlbum);
    const existingMetadata = await metadataRepository.find({
      where: { mbAlbumId: In(validIds) },
      select: ['mbAlbumId', 'caaUrl', 'updatedAt'],
    });

    const metadataMap = new Map(
      existingMetadata.map((metadata) => [
        normalizeMusicBrainzId(metadata.mbAlbumId),
        metadata,
      ])
    );

    for (const id of validIds) {
      const metadata = metadataMap.get(id);

      if (metadata?.caaUrl) {
        resultsMap.set(id, metadata.caaUrl);
      } else if (metadata && !this.isMetadataStale(metadata)) {
        resultsMap.set(id, null);
      } else {
        idsToFetch.push(id);
      }
    }

    if (idsToFetch.length > 0) {
      await mapWithConcurrency(
        idsToFetch,
        CoverArtArchive.BATCH_FETCH_CONCURRENCY,
        async (id) => {
          try {
            const response = await this.fetchCoverArt(id);
            const frontImage = response.images.find((img) => img.front);
            resultsMap.set(id, frontImage?.thumbnails?.[250] || null);
            return true;
          } catch (error) {
            logger.error('Failed to fetch cover art', {
              label: 'CoverArtArchive',
              id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            resultsMap.set(id, null);
            return false;
          }
        }
      );
    }

    const results: Record<string, string | null> = {};
    for (const [key, value] of resultsMap.entries()) {
      results[key] = value;
    }

    return results;
  }
}

export default CoverArtArchive;
