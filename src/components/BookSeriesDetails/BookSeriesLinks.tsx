import { encodeApiPathSegment } from '@app/utils/apiPath';
import defineMessages from '@app/utils/defineMessages';
import type { BookSeriesSummary } from '@server/models/BookSeries';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.BookSeriesLinks', {
  series: 'Series',
  ebook: 'Book',
  audiobook: 'Audiobook',
  position: '{title} · Book {position}',
  unavailable: 'Series information is temporarily unavailable.',
  partial: 'Some book servers could not provide series information.',
  source: '{server} · {format}',
});

export default function BookSeriesLinks({ bookId }: { bookId: string }) {
  const intl = useIntl();
  const { data, error } = useSWR<{
    status: string;
    series: BookSeriesSummary[];
  }>(`/api/v1/book/${encodeApiPathSegment(bookId)}/series`, {
    keepPreviousData: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  if (error || data?.status === 'unavailable')
    return (
      <p className="mt-3 text-sm text-gray-400">
        {intl.formatMessage(messages.unavailable)}
      </p>
    );
  if (!data) return null;
  const series = Array.isArray(data.series) ? data.series : [];
  if (series.length === 0) return null;
  return (
    <div
      className="mt-3 flex flex-wrap gap-2 text-sm"
      aria-label={intl.formatMessage(messages.series)}
    >
      <span>{intl.formatMessage(messages.series)}:</span>
      {data.status === 'partial' && (
        <span>{intl.formatMessage(messages.partial)}</span>
      )}
      {series.map((entry) => (
        <Link
          key={entry.id}
          href={`/book-series/${entry.id}`}
          title={intl.formatMessage(messages.source, {
            server: entry.serverName,
            format: intl.formatMessage(
              entry.format === 'ebook' ? messages.ebook : messages.audiobook
            ),
          })}
          className="rounded bg-gray-700 px-2 py-1 text-indigo-200 hover:bg-gray-600"
        >
          {entry.position === undefined
            ? entry.title
            : intl.formatMessage(messages.position, {
                title: entry.title,
                position: entry.position,
              })}
          {' · '}
          {intl.formatMessage(
            entry.format === 'ebook' ? messages.ebook : messages.audiobook
          )}
        </Link>
      ))}
    </div>
  );
}
