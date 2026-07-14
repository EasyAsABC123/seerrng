import useSettings from '@app/hooks/useSettings';
import type { CacheableImageType } from '@app/utils/imageCache';
import { getImageCacheUrl, getImageErrorFallback } from '@app/utils/imageCache';
import type { ImageLoader, ImageProps } from 'next/image';
import Image from 'next/image';
import { memo, useEffect, useMemo, useState } from 'react';

const imageLoader: ImageLoader = ({ src }) => src;

export type CachedImageProps = ImageProps & {
  src: string;
  type: CacheableImageType;
};

/**
 * The CachedImage component should be used wherever
 * we want to offer the option to locally cache images.
 **/
const CachedImage = memo(
  ({
    src,
    type,
    decoding = 'async',
    loading,
    priority,
    onError,
    ...props
  }: CachedImageProps) => {
    const { currentSettings } = useSettings();

    const imageUrl = useMemo(
      () =>
        getImageCacheUrl({
          cacheImages: currentSettings.cacheImages,
          src,
          type,
        }),
      [currentSettings.cacheImages, src, type]
    );
    const [activeImageUrl, setActiveImageUrl] = useState(imageUrl);

    useEffect(() => {
      setActiveImageUrl(imageUrl);
    }, [imageUrl]);

    return (
      <Image
        unoptimized
        loader={imageLoader}
        src={activeImageUrl}
        decoding={decoding}
        loading={priority ? undefined : (loading ?? 'lazy')}
        priority={priority}
        onError={(event) => {
          const fallbackImage = getImageErrorFallback(type, activeImageUrl);
          if (fallbackImage) {
            setActiveImageUrl(fallbackImage);
          }
          onError?.(event);
        }}
        {...props}
      />
    );
  }
);

CachedImage.displayName = 'CachedImage';

export default CachedImage;
