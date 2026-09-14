import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import { bookSeriesSearchUrl } from '@app/utils/bookSeriesSearch';
import defineMessages from '@app/utils/defineMessages';
import type { BookSeriesSearchResponse } from '@server/models/BookSeries';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.BookSeriesSearch.Results', {
  ebook: 'Books',
  audiobook: 'Audiobooks',
  library: 'Library subset',
  catalog: 'Series catalog',
  count: '{count, plural, one {# book} other {# books}}',
  formatOnServer: '{format} on {server}',
  libraryFormat: 'Library: {format}',
  empty: 'No matching series found.',
  disabled: 'No book server is configured for this format.',
  unsupported: 'Your book servers do not provide series search.',
  unavailable: 'Series search is unavailable. Please try again.',
  partial:
    'Some book servers or catalogs could not be searched. Available results are shown.',
  truncated:
    'Only part of the catalog could be searched or displayed. Try a more specific name.',
  retry: 'Try Again',
});

export default function BookSeriesSearchResults({
  query,
  format,
  limit = 100,
  sourceFilter,
}: {
  query: string;
  format?: 'ebook' | 'audiobook';
  limit?: number;
  sourceFilter?: 'catalog';
}) {
  const intl = useIntl();
  const url = bookSeriesSearchUrl(query, format);
  const valid = !!url;
  const { data, error, isValidating, mutate } =
    useSWR<BookSeriesSearchResponse>(url, {
      keepPreviousData: false,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 60000,
    });
  const results = (data?.results ?? []).filter(
    (series) => !sourceFilter || series.source === sourceFilter
  );
  const failed = error || data?.status === 'unavailable';
  return (
    <>
      {valid && !data && !error && <LoadingSpinner />}
      {failed && (
        <div role="alert" className="my-4 space-y-3">
          <p>{intl.formatMessage(messages.unavailable)}</p>
          <Button disabled={isValidating} onClick={() => mutate()}>
            {intl.formatMessage(messages.retry)}
          </Button>
        </div>
      )}
      {data?.status === 'partial' && (
        <div role="status" className="my-4 space-y-3">
          <p>{intl.formatMessage(messages.partial)}</p>
          <Button disabled={isValidating} onClick={() => mutate()}>
            {intl.formatMessage(messages.retry)}
          </Button>
        </div>
      )}
      {data?.truncated && (
        <p role="status" className="my-4">
          {intl.formatMessage(messages.truncated)}
        </p>
      )}
      {data && !results.length && !failed && data.status !== 'partial' && (
        <p className="my-6">
          {intl.formatMessage(
            data.status === 'disabled'
              ? messages.disabled
              : data.status === 'unsupported'
                ? messages.unsupported
                : messages.empty
          )}
        </p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {results.slice(0, limit).map((series) => (
          <li
            key={series.key}
            className="rounded-lg border border-gray-700 bg-gray-800 p-4"
          >
            <Link
              className="text-lg font-semibold text-indigo-200 hover:underline"
              href={series.href}
            >
              {series.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-300">
              {(series.variants ?? [series])
                .filter(
                  (variant) => !sourceFilter || variant.source === sourceFilter
                )
                .map((variant) => {
                  const formatLabel = intl.formatMessage(
                    variant.format === 'audiobook'
                      ? messages.audiobook
                      : messages.ebook
                  );
                  return (
                    <Link
                      key={variant.key}
                      href={variant.href}
                      className="text-indigo-300 hover:underline"
                      title={intl.formatMessage(messages.formatOnServer, {
                        format: formatLabel,
                        server: variant.serverName,
                      })}
                    >
                      {variant.source === 'library' &&
                      series.source === 'catalog'
                        ? intl.formatMessage(messages.libraryFormat, {
                            format: formatLabel,
                          })
                        : formatLabel}
                    </Link>
                  );
                })}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {intl.formatMessage(
                series.source === 'library'
                  ? messages.library
                  : messages.catalog
              )}
              {series.bookCount !== undefined &&
                ` · ${intl.formatMessage(messages.count, { count: series.bookCount })}`}
            </p>
            {series.description && (
              <p className="mt-3 line-clamp-3 text-sm text-gray-300">
                {series.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
