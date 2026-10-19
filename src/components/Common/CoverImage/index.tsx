import CachedImage from '@app/components/Common/CachedImage';
import type { CacheableImageType } from '@app/utils/imageCache';
import { PhotoIcon } from '@heroicons/react/24/outline';

interface CoverImageProps {
  src?: string | null;
  alt: string;
  type?: CacheableImageType;
  shape?: 'poster' | 'square';
}

/** Fixed-ratio cover used beside a title in choice cards. */
const CoverImage = ({
  src,
  alt,
  type = 'book',
  shape = 'poster',
}: CoverImageProps) => (
  <div className="cover-thumb" data-cover-shape={shape}>
    {src ? (
      <CachedImage
        type={type}
        src={src}
        alt={alt}
        width={112}
        height={shape === 'square' ? 112 : 168}
      />
    ) : (
      <PhotoIcon aria-hidden="true" />
    )}
  </div>
);

export default CoverImage;
