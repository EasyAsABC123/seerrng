import { bookSeriesSearchUrl } from '@app/utils/bookSeriesSearch';
import defineMessages from '@app/utils/defineMessages';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import BookSeriesSearchResults from './Results';

const messages = defineMessages('components.BookSeriesSearch.InlineResults', {
  title: 'Book Series',
  catalog: 'Other Catalog Matches',
  catalogHint:
    'Explore other catalog entries for this series. Their book lists may differ from your book server.',
  browse: 'View all series results',
  hint: 'Series matches use the name and selected format.',
});

export default function InlineBookSeriesResults({
  query,
  format,
  catalogOnly = false,
}: {
  query: string;
  format?: 'ebook' | 'audiobook';
  catalogOnly?: boolean;
}) {
  const intl = useIntl();
  if (!bookSeriesSearchUrl(query, format)) return null;
  return (
    <section
      aria-label={intl.formatMessage(
        catalogOnly ? messages.catalog : messages.title
      )}
      className="mb-6 text-gray-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">
          {intl.formatMessage(catalogOnly ? messages.catalog : messages.title)}
        </h2>
        <Link
          className="text-indigo-300 hover:underline"
          href={{
            pathname: '/book-series',
            query: { query, ...(format ? { format } : {}) },
          }}
        >
          {intl.formatMessage(messages.browse)}
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        {intl.formatMessage(catalogOnly ? messages.catalogHint : messages.hint)}
      </p>
      <BookSeriesSearchResults
        query={query}
        format={format}
        limit={6}
        sourceFilter={catalogOnly ? 'catalog' : undefined}
      />
    </section>
  );
}
