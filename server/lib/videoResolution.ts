/**
 * Classify a provider-reported video resolution without guessing when the
 * value is missing or malformed. A 4K-width encode remains 4K even when it is
 * cropped to a shorter aspect ratio; 1440p remains standard.
 */
export const is4kResolution = (resolution?: string): boolean | undefined => {
  const match = resolution?.trim().match(/^(\d{3,5})\s*x\s*(\d{3,5})$/i);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  return width >= 3000 || (height >= 2000 && width >= 1800);
};
