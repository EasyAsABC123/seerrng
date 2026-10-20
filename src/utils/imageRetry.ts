/**
 * A proxied image can fail transiently (the image proxy answers 429 when a
 * client asks for too much at once, or the upstream provider hiccups). Without
 * a retry the poster fell straight through to the "not found" placeholder and
 * stayed that way until the page was reloaded.
 *
 * Retries are bounded, back off, and carry random jitter so that a page full
 * of failed posters does not retry in lock-step and trip the limiter again.
 */
export const IMAGE_RETRY_DELAYS_MS = [2000, 6000] as const;
export const IMAGE_RETRY_MAX_JITTER_MS = 1500;

export const isRetryableImageUrl = (url: string): boolean =>
  url.includes('/imageproxy/');

export const getImageRetryDelayMs = (
  attempt: number,
  random: () => number = Math.random
): number | undefined => {
  const base = IMAGE_RETRY_DELAYS_MS[attempt];
  if (base === undefined) {
    return undefined;
  }

  return base + Math.floor(random() * IMAGE_RETRY_MAX_JITTER_MS);
};
