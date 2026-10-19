import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import axios from 'axios';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

interface CollectorPick {
  title: string;
  creator: string | null;
  year: number | null;
  score: number;
  trustedSourceCount: number;
  lastSeenAt: string;
  reasons: string[];
  album: { id: string; href: string; imageUrl?: string } | null;
  artistId: string | null;
}

const messages = defineMessages('components.Collectors', {
  title: 'Collector Picks',
  description:
    'Releases being shared by collectors you follow. Each one shows why it appeared.',
  unavailable:
    'Collector picks need slskdN with social federation turned on. An administrator can connect it in Settings → Services.',
  empty: 'Nothing is being shared by collectors you follow yet.',
  sharedBy:
    '{count, plural, one {Shared by # trusted collector} other {Shared by # trusted collectors}}',
  openAlbum: 'Open Album',
  followArtist: 'Follow Artist Releases',
  followed: 'You will hear about new releases from {artist}.',
  failed: 'The artist could not be followed.',
  notFound: 'Not matched to a catalog album',
});

const Collectors = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data } = useSWR<{ available: boolean; results: CollectorPick[] }>(
    '/api/v1/collectors'
  );

  const follow = async (pick: CollectorPick) => {
    if (!pick.artistId || !pick.creator) return;
    try {
      await axios.post('/api/v1/collectors/radar', {
        artistId: pick.artistId,
        artist: pick.creator,
      });
      addToast(
        intl.formatMessage(messages.followed, { artist: pick.creator }),
        {
          appearance: 'success',
          autoDismiss: true,
        }
      );
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  return (
    <div className="page-layout">
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="page-title-row">
        <h1 className="page-title">{intl.formatMessage(messages.title)}</h1>
        {!data && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <p className="card-body-text">
        {intl.formatMessage(messages.description)}
      </p>
      {data && !data.available && (
        <section className="app-card-main card-layout">
          <p className="card-body-text">
            {intl.formatMessage(messages.unavailable)}
          </p>
        </section>
      )}
      {data?.available && data.results.length === 0 && (
        <section className="app-card-main card-layout">
          <p className="card-body-text">{intl.formatMessage(messages.empty)}</p>
        </section>
      )}
      <ul className="card-list" data-list-layout="choices">
        {data?.results.map((pick) => (
          <li key={`${pick.title}-${pick.creator}`}>
            <article className="app-card-sub card-layout media-choice-card">
              <CoverImage
                src={pick.album?.imageUrl}
                alt=""
                type="music"
                shape="square"
              />
              <div data-card-part="body">
                <h3 className="card-title">{pick.title}</h3>
                <p className="card-subheading">
                  {[pick.creator, pick.year].filter(Boolean).join(' · ')}
                </p>
                <div className="media-fact-row">
                  <Badge badgeType="association">
                    {intl.formatMessage(messages.sharedBy, {
                      count: pick.trustedSourceCount,
                    })}
                  </Badge>
                  {!pick.album && (
                    <Badge badgeType="default">
                      {intl.formatMessage(messages.notFound)}
                    </Badge>
                  )}
                </div>
                {pick.reasons.map((reason) => (
                  <p key={reason} className="card-subheading">
                    {reason}
                  </p>
                ))}
                <div className="app-action-row">
                  {pick.album && (
                    <Link href={pick.album.href} legacyBehavior passHref>
                      <Button as="a" buttonType="primary" buttonSize="sm">
                        {intl.formatMessage(messages.openAlbum)}
                      </Button>
                    </Link>
                  )}
                  {pick.artistId && (
                    <Button
                      buttonType="default"
                      buttonSize="sm"
                      onClick={() => void follow(pick)}
                    >
                      {intl.formatMessage(messages.followArtist)}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Collectors;
