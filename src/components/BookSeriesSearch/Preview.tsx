import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import defineMessages from '@app/utils/defineMessages';
import type { BookSeriesPreview } from '@server/models/BookSeries';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.BookSeriesPreview', {
  title: 'Series Catalog Preview',
  scope:
    'A preview from your book server’s catalog. It may not list every book. Previewing does not request books or enable monitoring.',
  manage: 'Open in {server}',
  hint: 'To add this series to your library, continue in your book server.',
  unavailable: 'This series preview could not be loaded.',
  retry: 'Try Again',
  search: 'Search Book Series',
  empty: 'No books were included in this preview.',
  ebook: 'Books',
  audiobook: 'Audiobooks',
});

export default function BookSeriesPreview() {
  const intl = useIntl();
  const router = useRouter();
  const { serverId, scope, providerId } = router.query;
  const params =
    typeof serverId === 'string' &&
    typeof scope === 'string' &&
    typeof providerId === 'string'
      ? new URLSearchParams({ serverId, scope, providerId }).toString()
      : undefined;
  const { data, error, mutate } = useSWR<BookSeriesPreview>(
    router.isReady && params ? `/api/v1/book-series/catalog?${params}` : null,
    {
      keepPreviousData: false,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  if (!router.isReady || (params && !data && !error)) return <LoadingSpinner />;
  if (!data)
    return (
      <div className="mt-6 space-y-4">
        <p>{intl.formatMessage(messages.unavailable)}</p>
        <Button onClick={() => mutate()}>
          {intl.formatMessage(messages.retry)}
        </Button>
        <Link href="/book-series">{intl.formatMessage(messages.search)}</Link>
      </div>
    );
  return (
    <>
      <PageTitle title={data.title} />
      <p className="mt-6 text-sm text-gray-400">
        {intl.formatMessage(messages.title)}
      </p>
      <h1 className="my-3 text-3xl font-bold text-white">{data.title}</h1>
      <p className="mb-4 text-gray-300">
        {data.serverName} ·{' '}
        {intl.formatMessage(
          data.format === 'audiobook' ? messages.audiobook : messages.ebook
        )}
      </p>
      <p className="mb-4 text-gray-300">{intl.formatMessage(messages.scope)}</p>
      {data.description && (
        <p className="mb-4 whitespace-pre-line text-gray-300">
          {data.description}
        </p>
      )}
      <p className="mb-4 text-sm text-gray-400">
        {intl.formatMessage(messages.hint)}
      </p>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {data.managementUrl && (
          <Button
            as="a"
            href={data.managementUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {intl.formatMessage(messages.manage, { server: data.serverName })}
          </Button>
        )}
        <Link
          className="text-indigo-300 hover:underline"
          href={{
            pathname: '/book-series',
            query: { query: data.title, format: data.format },
          }}
        >
          {intl.formatMessage(messages.search)}
        </Link>
      </div>
      {!data.books.length && <p>{intl.formatMessage(messages.empty)}</p>}
      <ol className="divide-y divide-gray-700 rounded-lg border border-gray-700">
        {data.books.map((book, index) => (
          <li key={index} className="p-4">
            <span className="mr-3 text-gray-400">{book.position}</span>
            <span className="font-semibold text-gray-100">{book.title}</span>
            {book.author && (
              <span className="ml-3 text-gray-400">{book.author}</span>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
