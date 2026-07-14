export const MEDIA_SLIDER_TITLE_LIMIT = 20;

export const shouldShowMoreSliderCard = ({
  hasLink,
  loadedTitleCount,
  totalResults,
}: {
  hasLink: boolean;
  loadedTitleCount: number;
  totalResults: number;
}): boolean =>
  hasLink &&
  (loadedTitleCount > MEDIA_SLIDER_TITLE_LIMIT ||
    totalResults > MEDIA_SLIDER_TITLE_LIMIT);
