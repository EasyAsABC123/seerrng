import { MediaRequestStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import type Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import { restrictMediaRelationsForUser } from '@server/lib/mediaResponse';

export const hydrateMediaSummaryRelations = async (
  mediaItems: Media[],
  user?: User,
  options: { includeRequestSeasons?: boolean } = {}
): Promise<Media[]> => {
  const mediaIds = [
    ...new Set(
      mediaItems
        .map((media) => media.id)
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    ),
  ];
  if (!mediaIds.length) {
    return mediaItems;
  }

  let activeRequestQuery = getRepository(MediaRequest)
    .createQueryBuilder('request')
    .innerJoinAndSelect('request.media', 'requestMedia')
    .leftJoinAndSelect('request.requestedBy', 'requestedBy')
    .leftJoinAndSelect('request.modifiedBy', 'modifiedBy')
    .where('requestMedia.id IN (:...mediaIds)', { mediaIds })
    .andWhere('request.status NOT IN (:...inactiveStatuses)', {
      inactiveStatuses: [
        MediaRequestStatus.DECLINED,
        MediaRequestStatus.FAILED,
        MediaRequestStatus.COMPLETED,
      ],
    })
    .orderBy('request.createdAt', 'ASC');
  if (options.includeRequestSeasons) {
    activeRequestQuery = activeRequestQuery.leftJoinAndSelect(
      'request.seasons',
      'requestedSeason'
    );
  }

  const [activeRequests, userWatchlists] = await Promise.all([
    activeRequestQuery.getMany(),
    user
      ? getRepository(Watchlist)
          .createQueryBuilder('watchlist')
          .innerJoinAndSelect('watchlist.media', 'watchlistMedia')
          .where('watchlistMedia.id IN (:...mediaIds)', { mediaIds })
          .andWhere('watchlist.requestedBy = :userId', { userId: user.id })
          .getMany()
      : [],
  ]);
  const requestsByMediaId = new Map<number, MediaRequest[]>();
  for (const request of activeRequests) {
    const mediaId = request.media.id;
    request.media = undefined as unknown as Media;
    const requests = requestsByMediaId.get(mediaId) ?? [];
    requests.push(request);
    requestsByMediaId.set(mediaId, requests);
  }
  const watchlistsByMediaId = new Map<number, Watchlist[]>();
  for (const watchlist of userWatchlists) {
    const mediaId = watchlist.media.id;
    watchlist.media = undefined as unknown as Media;
    const watchlists = watchlistsByMediaId.get(mediaId) ?? [];
    watchlists.push(watchlist);
    watchlistsByMediaId.set(mediaId, watchlists);
  }

  for (const media of mediaItems) {
    media.requests = requestsByMediaId.get(media.id) ?? [];
    media.watchlists = watchlistsByMediaId.get(media.id) ?? [];
    restrictMediaRelationsForUser(media, user);
  }

  return mediaItems;
};
