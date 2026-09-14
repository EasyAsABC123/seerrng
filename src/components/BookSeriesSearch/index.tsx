import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import defineMessages from '@app/utils/defineMessages';
import type { BookSeriesSearchResponse } from '@server/models/BookSeries';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.BookSeriesSearch', {
  title: 'Search Book Series',
  query: 'Series name',
  search: 'Search',
  format: 'Format',
  all: 'All formats',
  ebook: 'Books',
  audiobook: 'Audiobooks',
  hint: 'Find series by name in your book library and supported catalogs.',
  library: 'Library series',
  catalog: 'Catalog preview',
  count: '{count, plural, one {# book} other {# books}}',
  empty: 'No matching series found.',
  disabled: 'No book server is configured for this format.',
  unsupported: 'Your book servers do not provide series search.',
  unavailable: 'Series search is unavailable. Please try again.',
  partial:
    'Some book servers or catalogs could not be searched. Available results are shown.',
  truncated:
    'Only part of the catalog could be searched or displayed. Try a more specific name.',
  retry: 'Try Again',
  media: 'Back to media search',
});

export default function BookSeriesSearch() {
  const intl = useIntl();
  const router = useRouter();
  const query =
    typeof router.query.query === 'string' ? router.query.query.trim() : '';
  const format =
    router.query.format === 'ebook' || router.query.format === 'audiobook'
      ? router.query.format
      : '';
  const [input, setInput] = useState(query);
  const [inputFormat, setInputFormat] = useState(format);
  useEffect(() => {
    setInput(query);
    setInputFormat(format);
  }, [query, format]);
  const valid = query.length >= 2 && query.length <= 200;
  const { data, error, isValidating, mutate } =
    useSWR<BookSeriesSearchResponse>(
      router.isReady && valid
        ? `/api/v1/book-series/search?${new URLSearchParams({ query, ...(format ? { format } : {}) }).toString().replace(/\+/g, '%20')}`
        : null,
      {
        keepPreviousData: false,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }
    );
  const failed = error || data?.status === 'unavailable';
  return (
    <>
      <PageTitle title={intl.formatMessage(messages.title)} />
      <h1 className="mt-6 mb-3 text-3xl font-bold text-white">
        {intl.formatMessage(messages.title)}
      </h1>
      <p className="mb-5 text-gray-300">{intl.formatMessage(messages.hint)}</p>
      <form
        className="mb-6 flex flex-wrap items-end gap-3 text-gray-300"
        onSubmit={(event) => {
          event.preventDefault();
          void router.push({
            pathname: '/book-series',
            query: {
              query: input.trim(),
              ...(inputFormat ? { format: inputFormat } : {}),
            },
          });
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="series-query">
            {intl.formatMessage(messages.query)}
          </label>
          <input
            id="series-query"
            className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            minLength={2}
            maxLength={200}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="series-format">
            {intl.formatMessage(messages.format)}
          </label>
          <select
            id="series-format"
            className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
            value={inputFormat}
            onChange={(e) => setInputFormat(e.target.value)}
          >
            <option value="">{intl.formatMessage(messages.all)}</option>
            <option value="ebook">{intl.formatMessage(messages.ebook)}</option>
            <option value="audiobook">
              {intl.formatMessage(messages.audiobook)}
            </option>
          </select>
        </div>
        <Button
          buttonType="primary"
          type="submit"
          disabled={input.trim().length < 2 || isValidating}
        >
          {intl.formatMessage(messages.search)}
        </Button>
      </form>
      <Link
        className="text-indigo-300 hover:underline"
        href={{ pathname: '/search', query: { query } }}
      >
        {intl.formatMessage(messages.media)}
      </Link>
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
      {data && !data.results.length && !failed && data.status !== 'partial' && (
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
        {data?.results.map((series) => (
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
            <p className="mt-2 text-sm text-gray-300">
              {series.serverName} ·{' '}
              {intl.formatMessage(
                series.format === 'audiobook'
                  ? messages.audiobook
                  : messages.ebook
              )}
            </p>
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
