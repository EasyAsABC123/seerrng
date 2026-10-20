import useSettings from '@app/hooks/useSettings';
import { getTmdbPosterImageUrl } from '@app/utils/imageCache';
import { enqueueImageWarm } from '@app/utils/imageWarmQueue';
import { useEffect, useMemo } from 'react';

type ImageWarmableResult = {
  mediaType?: string;
  posterPath?: string | null;
  remotePoster?: string | null;
  backdropPath?: string | null;
  profilePath?: string | null;
  artistThumb?: string | null;
  artistBackdrop?: string | null;
};

export const MAIN_MEDIA_POSTER_CACHE_WARM_LIMIT = 100;
export const DISCOVER_SHELF_POSTER_CACHE_WARM_LIMIT = 50;

const getTmdbImageUrl = (path: string, size: string): string =>
  `https://image.tmdb.org/t/p/${size}${path}`;

const normalizeExternalImageUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }

  if (path.startsWith('http')) {
    return path;
  }

  return null;
};

export const getImageUrls = (
  item: ImageWarmableResult,
  posterOnly = false
): string[] => {
  const urls: (string | null)[] = [];

  if (
    item.posterPath &&
    ['movie', 'tv', 'person', 'collection'].includes(item.mediaType ?? '')
  ) {
    urls.push(
      normalizeExternalImageUrl(getTmdbPosterImageUrl(item.posterPath))
    );
  } else {
    urls.push(normalizeExternalImageUrl(item.posterPath));
  }

  urls.push(normalizeExternalImageUrl(item.remotePoster));

  if (posterOnly) {
    urls.push(normalizeExternalImageUrl(item.artistThumb));
    return urls.filter((url): url is string => !!url);
  }

  if (
    item.backdropPath &&
    ['movie', 'tv', 'collection'].includes(item.mediaType ?? '')
  ) {
    urls.push(getTmdbImageUrl(item.backdropPath, 'w1920_and_h800_multi_faces'));
  }

  if (item.profilePath) {
    urls.push(
      item.profilePath.startsWith('/')
        ? getTmdbImageUrl(item.profilePath, 'w600_and_h900_bestv2')
        : normalizeExternalImageUrl(item.profilePath)
    );
  }

  urls.push(
    normalizeExternalImageUrl(item.artistThumb),
    normalizeExternalImageUrl(item.artistBackdrop)
  );

  return urls.filter((url): url is string => !!url);
};

const useWarmImageCache = (
  items?: ImageWarmableResult[],
  options: { enabled?: boolean; maxUrls?: number; posterOnly?: boolean } = {}
) => {
  const { currentSettings } = useSettings();
  const { enabled = true, maxUrls, posterOnly = false } = options;
  const imageUrls = useMemo(
    () =>
      [
        ...new Set(
          (items ?? []).flatMap((item) => getImageUrls(item, posterOnly))
        ),
      ].slice(0, maxUrls),
    [items, maxUrls, posterOnly]
  );

  useEffect(() => {
    if (
      !enabled ||
      !currentSettings.cacheImages ||
      imageUrls.length === 0 ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    // All components share one rate-aware queue (see imageWarmQueue).
    const warm = () => enqueueImageWarm(imageUrls);

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(warm, {
        timeout: 3000,
      });

      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = globalThis.setTimeout(warm, 250);

    return () => globalThis.clearTimeout(timeoutId);
  }, [currentSettings.cacheImages, enabled, imageUrls]);
};

export default useWarmImageCache;
