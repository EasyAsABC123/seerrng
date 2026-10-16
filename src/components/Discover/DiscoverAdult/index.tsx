import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import MediaTypeBadge from '@app/components/Common/MediaTypeBadge';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import useDiscoverScrollRestoration from '@app/hooks/useDiscoverScrollRestoration';
import { useSearchActivityReporter } from '@app/hooks/useSearchActivity';
import { useBatchUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import { encodeApiPathSegment } from '@app/utils/apiPath';
import defineMessages from '@app/utils/defineMessages';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import type { AdultResult } from '@server/models/Adult';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverAdult', {
  title: 'Adult',
  search: 'Search adult scenes',
  searchPlaceholder: 'Title, performer, or studio',
  searchHint: 'Search scenes indexed by your configured Whisparr servers.',
  partialResults:
    'Some Whisparr servers could not be searched. Results may be incomplete.',
  unavailable: 'Adult scene search is unavailable right now.',
  noResults: 'No scenes match this search.',
  searchToBegin: 'Search for a scene to browse the Adult catalog.',
  loadMore: 'Load more scenes',
  year: '({year})',
  studio: 'Studio: {studio}',
  requestStatus: 'You have an active request for this scene.',
});

const DiscoverAdult = () => {
  const intl = useIntl();
  const router = useRouter();
  const update = useBatchUpdateQueryParams({});
  const query =
    typeof router.query.query === 'string' ? router.query.query : '';
  const [search, setSearch] = useState(query);
  useEffect(() => {
    setSearch(query);
  }, [query]);

  const discover = useDiscover<AdultResult, { partial?: boolean }>(
    '/api/v1/adult/search',
    { query },
    {
      hideAvailable: false,
      hideBlocklisted: false,
      showErrorToast: false,
      hideErrorWithResults: false,
      shouldRetryOnError: false,
    }
  );
  useDiscoverScrollRestoration({
    mediaType: 'adult',
    itemCount: discover.titles.length,
    shuffleSeed: discover.shuffleSeed,
    isLoading: discover.isLoadingInitialData || discover.isLoadingMore,
    isReachingEnd: discover.isReachingEnd,
    fetchMore: discover.fetchMore,
  });
  useSearchActivityReporter(
    Boolean(search.trim()) &&
      (search.trim() !== query.trim() ||
        discover.isLoadingInitialData ||
        discover.isValidating),
    'adult-scene-search'
  );

  const providerMessage = (
    discover.error as { response?: { data?: { message?: string } } } | undefined
  )?.response?.data?.message;

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="app-filter-section-gap">
        <Header>{intl.formatMessage(messages.title)}</Header>
        <p className="description mt-2">
          {intl.formatMessage(messages.searchHint)}
        </p>
        <form
          className="app-filter-row"
          onSubmit={(event) => {
            event.preventDefault();
            const nextSearch = search.trim();
            update({ query: nextSearch || undefined, page: undefined });
          }}
        >
          <label className="discover-filter-control app-filter-search-control">
            <span
              className={`discover-filter-control-label ${
                search.trim() ? 'discover-filter-control-label-active' : ''
              }`}
            >
              <MagnifyingGlassIcon aria-hidden="true" />
              {intl.formatMessage(messages.search)}
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={intl.formatMessage(messages.searchPlaceholder)}
              aria-label={intl.formatMessage(messages.search)}
              maxLength={200}
              className="app-filter-search-input"
            />
          </label>
          <Button buttonType="primary" buttonSize="sm" type="submit">
            {intl.formatMessage(messages.search)}
          </Button>
        </form>
      </div>
      {discover.error && (
        <Alert
          title={providerMessage ?? intl.formatMessage(messages.unavailable)}
          type="warning"
        />
      )}
      {discover.firstResultData?.partial && (
        <Alert type="info">{intl.formatMessage(messages.partialResults)}</Alert>
      )}
      {!query.trim() && !discover.isLoadingInitialData && (
        <Alert type="info">{intl.formatMessage(messages.searchToBegin)}</Alert>
      )}
      {query.trim() &&
        !discover.error &&
        !discover.isLoadingInitialData &&
        discover.isEmpty && (
          <Alert type="info">{intl.formatMessage(messages.noResults)}</Alert>
        )}
      {discover.titles.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {discover.titles.map((scene) => (
            <Link
              key={scene.id}
              href={`/adult/${encodeApiPathSegment(scene.id)}`}
              className="app-card-main refreshed-card-surface flex min-h-36 flex-col gap-3 rounded-lg border border-gray-700 p-4 transition hover:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 text-lg font-semibold text-white">
                  {scene.title}
                  {scene.year
                    ? ` ${intl.formatMessage(messages.year, { year: scene.year })}`
                    : ''}
                </h2>
                <MediaTypeBadge mediaType="adult" variant="compact" />
              </div>
              {scene.studio && (
                <p className="text-sm text-gray-300">
                  {intl.formatMessage(messages.studio, {
                    studio: scene.studio,
                  })}
                </p>
              )}
              {scene.mediaInfo?.requestStatus && (
                <p className="mt-auto text-sm text-indigo-200">
                  {intl.formatMessage(messages.requestStatus)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
      {query.trim() && !discover.isReachingEnd && (
        <div className="mt-6 flex justify-center">
          <Button
            buttonType="default"
            buttonSize="sm"
            onClick={discover.fetchMore}
            disabled={discover.isLoadingMore}
          >
            {intl.formatMessage(messages.loadMore)}
          </Button>
        </div>
      )}
    </>
  );
};

export default DiscoverAdult;
