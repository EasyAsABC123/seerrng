export interface FollowTarget {
  mediaType: string;
  id: string;
  variantKey?: string;
}

/** In-app destination that opens (and lets the person request) a followed item. */
export const targetHref = (
  target: FollowTarget | null | undefined,
  title: string
): string => {
  if (!target) return `/search?query=${encodeURIComponent(title)}`;
  switch (target.mediaType) {
    case 'book':
      return `/book/${encodeURIComponent(target.id)}${
        target.variantKey ? '?format=audiobook' : ''
      }`;
    case 'album':
      return `/music/${encodeURIComponent(target.id)}`;
    case 'game':
      return `/software?category=game&game=${encodeURIComponent(target.id)}`;
    case 'patch':
      return `/software?category=retro&patch=${encodeURIComponent(target.id)}`;
    case 'movie':
    case 'tv':
      return `/${target.mediaType}/${encodeURIComponent(target.id)}`;
    default:
      return `/search?query=${encodeURIComponent(target.id || title)}`;
  }
};
