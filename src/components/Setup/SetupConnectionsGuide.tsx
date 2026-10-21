import Button from '@app/components/Common/Button';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowDownTrayIcon,
  BookOpenIcon,
  FilmIcon,
  MusicalNoteIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/solid';
import type { EnabledMediaCategories } from '@server/constants/mediaCategories';
import { MediaServerType } from '@server/constants/server';
import { useIntl, type MessageDescriptor } from 'react-intl';
import type { SetupDownloadProfile } from './setupDownloadClients';
import type { SetupServiceCategory } from './setupServiceCategories';
import { getSetupServiceCategories } from './setupServiceCategories';

const messages = defineMessages('components.Setup', {
  chooseConnectionsTitle: 'What would you like to connect?',
  chooseConnectionsDescription:
    'Choose a section to set up. Each connection is optional, and you can finish now and add services later in Settings.',
  mediaServerTitle: 'Media server',
  mediaServerConfigured: 'Connected as {name}',
  reviewMediaServer: 'Review',
  movieServicesTitle: 'Movies & TV',
  movieServicesDescription:
    'Connect the apps that handle movie and series requests, such as Radarr and Sonarr.',
  bookServicesTitle: 'Books, comics & magazines',
  bookServicesDescription:
    'Connect the services you use for books, audiobooks, comics, and magazines.',
  musicServicesTitle: 'Music',
  musicServicesDescription:
    'Connect a music request service or an existing music library.',
  toolsServicesTitle: 'System tools',
  toolsServicesDescription:
    'Set up Prowlarr, software services, and other optional tools.',
  downloadsTitle: 'Download progress',
  downloadsDescription:
    'Choose whether your setup uses Usenet, torrents, or both for live progress.',
  openConnections: 'Choose services',
  downloadsQuestion: 'How do your downloads arrive?',
  downloadsQuestionDescription:
    'SeerrNG reads live progress from supported clients. It does not send or manage downloads.',
  usenetTitle: 'Usenet',
  usenetDescription: 'Connect SABnzbd to show live download progress.',
  torrentTitle: 'Torrents',
  torrentDescription:
    'Connect qBittorrent, Transmission, Deluge, rTorrent, or TorrentNG.',
  bothTitle: 'Both',
  bothDescription: 'Add a Usenet client and a torrent client in one pass.',
  configureUsenet: 'Set up Usenet',
  configureTorrents: 'Set up torrents',
  configureBoth: 'Set up both',
  backToChoices: 'Back to choices',
});

const categoryDetails = {
  'tv-movies': {
    title: messages.movieServicesTitle,
    description: messages.movieServicesDescription,
    Icon: FilmIcon,
  },
  'audiobooks-books': {
    title: messages.bookServicesTitle,
    description: messages.bookServicesDescription,
    Icon: BookOpenIcon,
  },
  music: {
    title: messages.musicServicesTitle,
    description: messages.musicServicesDescription,
    Icon: MusicalNoteIcon,
  },
  'tools-other': {
    title: messages.toolsServicesTitle,
    description: messages.toolsServicesDescription,
    Icon: Square3Stack3DIcon,
  },
} satisfies Record<
  SetupServiceCategory,
  {
    title: MessageDescriptor;
    description: MessageDescriptor;
    Icon: typeof FilmIcon;
  }
>;

interface ChoiceCardProps {
  Icon: typeof FilmIcon;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}

const ChoiceCard = ({
  Icon,
  title,
  description,
  action,
  onClick,
}: ChoiceCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex h-full min-h-44 w-full flex-col items-start rounded-md border border-gray-600 bg-gray-900/40 p-4 text-start transition-colors hover:border-indigo-400 hover:bg-gray-800/80 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
  >
    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-indigo-500/50 bg-indigo-900/40 text-indigo-200">
      <Icon aria-hidden="true" className="h-5 w-5" />
    </span>
    <span className="text-base font-semibold text-white">{title}</span>
    <span className="mt-1 flex-1 text-sm leading-5 text-gray-300">
      {description}
    </span>
    <span className="mt-4 text-sm font-medium text-indigo-200 group-hover:text-white">
      {action}
    </span>
  </button>
);

interface SetupConnectionsGuideProps {
  view: 'overview' | 'downloads';
  enabledMediaCategories: EnabledMediaCategories;
  mediaServerType: MediaServerType;
  showMediaServer: boolean;
  onOpenMediaServer: () => void;
  onSelectCategory: (category: SetupServiceCategory) => void;
  onOpenDownloads: () => void;
  onSelectDownloadProfile: (profile: SetupDownloadProfile) => void;
  onBack: () => void;
}

const SetupConnectionsGuide = ({
  view,
  enabledMediaCategories,
  mediaServerType,
  showMediaServer,
  onOpenMediaServer,
  onSelectCategory,
  onOpenDownloads,
  onSelectDownloadProfile,
  onBack,
}: SetupConnectionsGuideProps) => {
  const intl = useIntl();
  const visibleCategories = getSetupServiceCategories(enabledMediaCategories);
  const mediaServerName =
    mediaServerType === MediaServerType.PLEX
      ? 'Plex'
      : mediaServerType === MediaServerType.JELLYFIN
        ? 'Jellyfin'
        : mediaServerType === MediaServerType.EMBY
          ? 'Emby'
          : '';

  if (view === 'downloads') {
    return (
      <section aria-labelledby="setup-downloads-title">
        <div className="mb-5">
          <h2
            id="setup-downloads-title"
            className="text-xl font-semibold text-white sm:text-2xl"
          >
            {intl.formatMessage(messages.downloadsQuestion)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
            {intl.formatMessage(messages.downloadsQuestionDescription)}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ChoiceCard
            Icon={ArrowDownTrayIcon}
            title={intl.formatMessage(messages.usenetTitle)}
            description={intl.formatMessage(messages.usenetDescription)}
            action={intl.formatMessage(messages.configureUsenet)}
            onClick={() => onSelectDownloadProfile('usenet')}
          />
          <ChoiceCard
            Icon={ArrowDownTrayIcon}
            title={intl.formatMessage(messages.torrentTitle)}
            description={intl.formatMessage(messages.torrentDescription)}
            action={intl.formatMessage(messages.configureTorrents)}
            onClick={() => onSelectDownloadProfile('torrents')}
          />
          <ChoiceCard
            Icon={ArrowDownTrayIcon}
            title={intl.formatMessage(messages.bothTitle)}
            description={intl.formatMessage(messages.bothDescription)}
            action={intl.formatMessage(messages.configureBoth)}
            onClick={() => onSelectDownloadProfile('both')}
          />
        </div>
        <div className="mt-5">
          <Button buttonType="default" onClick={onBack}>
            {intl.formatMessage(messages.backToChoices)}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="setup-connections-title">
      <div className="mb-5">
        <h2
          id="setup-connections-title"
          className="text-xl font-semibold text-white sm:text-2xl"
        >
          {intl.formatMessage(messages.chooseConnectionsTitle)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
          {intl.formatMessage(messages.chooseConnectionsDescription)}
        </p>
      </div>

      {showMediaServer && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-600 bg-gray-900/40 p-4">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {intl.formatMessage(messages.mediaServerTitle)}
            </h3>
            <p className="mt-1 text-sm text-gray-300">
              {intl.formatMessage(messages.mediaServerConfigured, {
                name: mediaServerName,
              })}
            </p>
          </div>
          <Button buttonType="default" onClick={onOpenMediaServer}>
            {intl.formatMessage(messages.reviewMediaServer)}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleCategories.map((category) => {
          const detail = categoryDetails[category];

          return (
            <ChoiceCard
              key={category}
              Icon={detail.Icon}
              title={intl.formatMessage(detail.title)}
              description={intl.formatMessage(detail.description)}
              action={intl.formatMessage(messages.openConnections)}
              onClick={() => onSelectCategory(category)}
            />
          );
        })}
        <ChoiceCard
          Icon={ArrowDownTrayIcon}
          title={intl.formatMessage(messages.downloadsTitle)}
          description={intl.formatMessage(messages.downloadsDescription)}
          action={intl.formatMessage(messages.openConnections)}
          onClick={onOpenDownloads}
        />
      </div>
    </section>
  );
};

export default SetupConnectionsGuide;
