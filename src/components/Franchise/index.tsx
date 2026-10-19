import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import FollowButton from '@app/components/Following/FollowButton';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import type { FranchiseGroup, FranchiseResult } from '@server/lib/franchise';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Franchise', {
  title: 'Franchise',
  titled: '{title} Franchise',
  description:
    'Original works, adaptations, sequels, and side stories, and where each one stands in your library.',
  groupSource: 'Original Works',
  groupAdaptation: 'Adaptations',
  groupPrequel: 'Before This',
  groupSequel: 'After This',
  groupSideStory: 'Side Stories',
  groupSoundtrack: 'Soundtracks',
  groupRelated: 'Related',
  anime: 'Anime',
  manga: 'Manga',
  novel: 'Light Novel',
  movie: 'Movie',
  tv: 'Series',
  game: 'Game',
  album: 'Album',
  book: 'Book',
  confidenceHigh: 'Documented',
  confidenceModerate: 'Partly Documented',
  confidenceLow: 'Uncertain',
  verified: 'Confirmed',
  open: 'Open',
  confirm: 'Confirm',
  hide: 'Hide',
  none: 'No related works are known for this title yet.',
  noMatch:
    'This series is not matched to an anime catalog, so only curated links can appear.',
  followFranchise: 'Follow New Connections',
  failed: 'The change could not be saved.',
});

const groupOrder: FranchiseGroup[] = [
  'source',
  'prequel',
  'sequel',
  'side-story',
  'adaptation',
  'soundtrack',
  'related',
];

const groupMessages = {
  source: messages.groupSource,
  adaptation: messages.groupAdaptation,
  prequel: messages.groupPrequel,
  sequel: messages.groupSequel,
  'side-story': messages.groupSideStory,
  soundtrack: messages.groupSoundtrack,
  related: messages.groupRelated,
} as const;

const typeMessages = {
  anime: messages.anime,
  manga: messages.manga,
  novel: messages.novel,
  movie: messages.movie,
  tv: messages.tv,
  game: messages.game,
  album: messages.album,
  book: messages.book,
} as const;

const confidenceMessages = {
  high: messages.confidenceHigh,
  moderate: messages.confidenceModerate,
  low: messages.confidenceLow,
} as const;

const Franchise = () => {
  const intl = useIntl();
  const router = useRouter();
  const { addToast } = useToasts();
  const mediaType =
    typeof router.query.mediaType === 'string'
      ? router.query.mediaType
      : undefined;
  const id = typeof router.query.id === 'string' ? router.query.id : undefined;
  const { data, mutate } = useSWR<FranchiseResult & { canCurate: boolean }>(
    mediaType && id
      ? `/api/v1/franchise/${mediaType}/${id}?language=${intl.locale}`
      : null
  );

  const curate = async (
    relationId: number,
    patch: { verified?: boolean; rejected?: boolean }
  ) => {
    try {
      await axios.patch(`/api/v1/franchise/relations/${relationId}`, patch);
      await mutate();
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const title = data?.anchor.title
    ? intl.formatMessage(messages.titled, { title: data.anchor.title })
    : intl.formatMessage(messages.title);

  return (
    <div className="page-layout">
      <PageTitle title={title} />
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        {!data && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <p className="card-body-text">
        {intl.formatMessage(messages.description)}
      </p>
      {data?.notes.includes('no-anilist-match') && (
        <p className="card-subheading">
          {intl.formatMessage(messages.noMatch)}
        </p>
      )}
      {data && mediaType && id && (
        <div className="app-action-row">
          <FollowButton
            label={intl.formatMessage(messages.followFranchise)}
            input={{
              kind: 'franchise',
              subjectKey: `${mediaType}:${id}`,
              subjectLabel: data.anchor.title || id,
              conditions: { ref: { anchorId: id, anchorType: mediaType } },
            }}
          />
        </div>
      )}
      {data && data.items.length === 0 && (
        <section className="app-card-main card-layout">
          <p className="card-body-text">{intl.formatMessage(messages.none)}</p>
        </section>
      )}
      {groupOrder.map((group) => {
        const items = data?.items.filter((item) => item.group === group) ?? [];
        if (!items.length) return null;
        return (
          <section key={group}>
            <h2 className="page-heading">
              {intl.formatMessage(groupMessages[group])}
            </h2>
            <ul className="card-list" data-list-layout="choices">
              {items.map((item) => (
                <li key={`${item.relation}-${item.title}-${item.mediaType}`}>
                  <article className="app-card-sub card-layout media-choice-card">
                    <CoverImage src={item.imageUrl} alt="" />
                    <div data-card-part="body">
                      <h3 className="card-title">{item.title}</h3>
                      <p className="card-subheading">
                        {[item.format, item.year].filter(Boolean).join(' · ')}
                      </p>
                      <div className="media-fact-row">
                        <Badge badgeType="primary">
                          {intl.formatMessage(
                            typeMessages[item.mediaType] ?? messages.anime
                          )}
                        </Badge>
                        <Badge
                          badgeType={
                            item.verified
                              ? 'success'
                              : item.confidence === 'high'
                                ? 'success'
                                : 'warning'
                          }
                        >
                          {intl.formatMessage(
                            item.verified
                              ? messages.verified
                              : confidenceMessages[item.confidence]
                          )}
                        </Badge>
                      </div>
                      {item.evidence && (
                        <p className="card-subheading">{item.evidence}</p>
                      )}
                      <div className="app-action-row">
                        <Link href={item.href} legacyBehavior passHref>
                          <Button as="a" buttonType="primary" buttonSize="sm">
                            {intl.formatMessage(messages.open)}
                          </Button>
                        </Link>
                        {data?.canCurate && item.relationId && (
                          <>
                            {!item.verified && (
                              <Button
                                buttonType="default"
                                buttonSize="sm"
                                onClick={() =>
                                  void curate(item.relationId as number, {
                                    verified: true,
                                  })
                                }
                              >
                                {intl.formatMessage(messages.confirm)}
                              </Button>
                            )}
                            <Button
                              buttonType="danger"
                              buttonSize="sm"
                              onClick={() =>
                                void curate(item.relationId as number, {
                                  rejected: true,
                                })
                              }
                            >
                              {intl.formatMessage(messages.hide)}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

export default Franchise;
