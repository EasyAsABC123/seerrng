import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import AdultSceneCard from '@app/components/Discover/DiscoverAdult/AdultSceneCard';
import useDiscover from '@app/hooks/useDiscover';
import useDiscoverScrollRestoration from '@app/hooks/useDiscoverScrollRestoration';
import { useSearchActivityReporter } from '@app/hooks/useSearchActivity';
import { useBatchUpdateQueryParams } from '@app/hooks/useUpdateQueryParams';
import defineMessages from '@app/utils/defineMessages';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import type { AdultResult } from '@server/models/Adult';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.DiscoverAdult', {
  title: 'Adult',
  search: 'Search adult scenes',
  searchPlaceholder: 'Title, performer, or studio',
  searchHint:
    'Browse scenes in your Whisparr libraries or search by title, performer, or studio.',
  recentScenes: 'Recently added scenes',
  searchResults: 'Search results',
  resultCount: '{count, plural, one {# scene} other {# scenes}}',
  partialResults:
    'Some Whisparr servers could not be searched. Results may be incomplete.',
  unavailable: 'Adult scene search is unavailable right now.',
  noResults: 'No scenes match this search.',
  noLibraryScenes:
    'No scenes are in your Whisparr libraries yet. Search above to browse the scene catalog.',
  loadMore: 'Load more scenes',
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
  const resultCount = discover.firstResultData?.totalResults ?? 0;

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
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">
          {intl.formatMessage(
            query.trim() ? messages.searchResults : messages.recentScenes
          )}
        </h2>
        {!discover.isLoadingInitialData && resultCount > 0 && (
          <span className="text-sm text-gray-400">
            {intl.formatMessage(messages.resultCount, { count: resultCount })}
          </span>
        )}
      </div>
      {query.trim() &&
        !discover.error &&
        !discover.isLoadingInitialData &&
        discover.isEmpty && (
          <Alert type="info">{intl.formatMessage(messages.noResults)}</Alert>
        )}
      {!query.trim() &&
        !discover.error &&
        !discover.isLoadingInitialData &&
        discover.isEmpty && (
          <Alert type="info">
            {intl.formatMessage(messages.noLibraryScenes)}
          </Alert>
        )}
      {discover.isLoadingInitialData && discover.titles.length === 0 && (
        <div
          aria-label={intl.formatMessage(messages.recentScenes)}
          aria-busy="true"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {Array.from({ length: 10 }, (_, index) => (
            <div
              key={index}
              className="animate-pulse overflow-hidden rounded-lg border border-gray-700 bg-gray-900/60"
            >
              <div className="aspect-[2/3] bg-gray-800" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 rounded bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      )}
      {discover.titles.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {discover.titles.map((scene) => (
            <AdultSceneCard
              key={`${scene.serviceId}:${scene.id}`}
              scene={scene}
            />
          ))}
        </div>
      )}
      {discover.titles.length > 0 && !discover.isReachingEnd && (
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
