import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import type {
  BookRecommendation,
  RecommendationFeed,
} from '@server/lib/hardcoverRecommendations';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.BookRecommendations', {
  title: 'Book Recommendations',
  description:
    'Browse personal, featured, and popular book recommendations from Hardcover. Filter a feed, then request a book in your preferred format.',
  noToken:
    'Connect Hardcover by adding an API token to a Hardcover list in your profile with permission to read book recommendation feeds.',
  scope:
    'Your Hardcover token needs permission to read book recommendation feeds.',
  rejected: 'Hardcover rejected your API token.',
  unavailable: 'Hardcover is not responding.',
  sourceMine: 'Yours',
  sourceFeatured: 'Featured',
  sourcePopular: 'Popular',
  likes: '{count, plural, one {# like} other {# likes}}',
  open: 'Show Books',
  tuning: 'Filter This Feed',
  standalones: 'Standalones only',
  firstInSeries: 'Standalones and first books in a series',
  lessPopular: 'Less popular discoveries',
  includeAuthors: 'Only these authors (comma separated)',
  excludeAuthors: 'Leave out these authors (comma separated)',
  moreLike: 'More like this',
  lessLike: 'Less like this',
  applied: 'Showing {shown} of {total}.',
  loading: 'Loading the feed…',
  empty: 'No books match these settings.',
  seriesPart: '{series} #{position}',
  request: 'Request',
  format: 'Format',
  ebook: 'Book',
  audiobook: 'Audiobook',
  noMatch: 'We could not find “{title}” in the catalog yet.',
  createHeading: 'Create a Personalized Feed',
  createHelp:
    'Hardcover requires a Supporter account to create a personalized recommendation feed. SeerrNG sends your settings to Hardcover.',
  createTitle: 'Name',
  createMood: 'Mood (optional)',
  createFirst: 'Standalones and first books',
  create: 'Create on Hardcover',
  created: 'Created your personalized feed on Hardcover.',
  supporter:
    'Creating a personalized feed requires a Hardcover Supporter account.',
  createFailed: 'The personalized feed could not be created.',
});

interface BookRecommendationsResponse {
  available: boolean;
  code?: 'no-token' | 'rejected' | 'scope' | 'unavailable';
  results?: RecommendationFeed[];
}

interface BooksResponse {
  available: boolean;
  books: BookRecommendation[];
  total: number;
}

const sourceMessages = {
  mine: messages.sourceMine,
  featured: messages.sourceFeatured,
  popular: messages.sourcePopular,
} as const;

const splitNames = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const BookRecommendations = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { data } = useSWR<BookRecommendationsResponse>(
    '/api/v1/book-recommendations'
  );
  const [openId, setOpenId] = useState<number>();
  const [standalones, setStandalones] = useState(false);
  const [firstInSeries, setFirstInSeries] = useState(false);
  const [lessPopular, setLessPopular] = useState(false);
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [more, setMore] = useState<number[]>([]);
  const [less, setLess] = useState<number[]>([]);
  const [format, setFormat] = useState<'ebook' | 'audiobook'>('ebook');
  const [books, setBooks] = useState<BooksResponse>();
  const [loading, setLoading] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createMood, setCreateMood] = useState('');
  const [createFirst, setCreateFirst] = useState(false);

  const load = useCallback(async () => {
    if (!openId) return;
    setLoading(true);
    try {
      const response = await axios.post<BooksResponse>(
        `/api/v1/book-recommendations/${openId}/books`,
        {
          tuning: {
            standalones,
            firstInSeries,
            lessPopular,
            includeAuthors: splitNames(include),
            excludeAuthors: splitNames(exclude),
            moreLike: more,
            lessLike: less,
          },
        }
      );
      setBooks(response.data);
    } finally {
      setLoading(false);
    }
  }, [
    openId,
    standalones,
    firstInSeries,
    lessPopular,
    include,
    exclude,
    more,
    less,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestBook = async (book: BookRecommendation) => {
    try {
      const resolved = await axios.post<{
        groups: { candidates: { id: string; href: string }[] }[];
      }>('/api/v1/resolve', {
        isbn: book.isbn13,
        text: book.isbn13
          ? undefined
          : `${book.title}${book.author ? ` by ${book.author}` : ''}`,
        types: ['book'],
        formatHint: format,
      });
      const match = resolved.data.groups[0]?.candidates[0];
      if (!match) {
        addToast(intl.formatMessage(messages.noMatch, { title: book.title }), {
          appearance: 'warning',
          autoDismiss: true,
        });
        return;
      }
      window.location.assign(match.href);
    } catch {
      addToast(intl.formatMessage(messages.noMatch, { title: book.title }), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const create = async () => {
    try {
      await axios.post('/api/v1/book-recommendations', {
        title: createTitle,
        mood: createMood || undefined,
        seriesPosition: createFirst ? 'first_or_standalone' : undefined,
        lessPopular,
        likeBookIds: more,
        dislikeBookIds: less,
      });
      addToast(intl.formatMessage(messages.created), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch (error) {
      addToast(
        intl.formatMessage(
          axios.isAxiosError(error) && error.response?.status === 403
            ? messages.supporter
            : messages.createFailed
        ),
        { appearance: 'error', autoDismiss: true }
      );
    }
  };

  const toggle = (
    list: number[],
    set: (next: number[]) => void,
    other: number[],
    setOther: (next: number[]) => void,
    id: number
  ) => {
    set(
      list.includes(id) ? list.filter((value) => value !== id) : [...list, id]
    );
    setOther(other.filter((value) => value !== id));
  };

  const notice =
    data && !data.available
      ? data.code === 'no-token'
        ? messages.noToken
        : data.code === 'scope'
          ? messages.scope
          : data.code === 'rejected'
            ? messages.rejected
            : messages.unavailable
      : undefined;

  return (
    <div className="page-layout">
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="page-title-row">
        <h1 className="page-title">{intl.formatMessage(messages.title)}</h1>
        {(loading || !data) && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <p className="card-body-text">
        {intl.formatMessage(messages.description)}
      </p>
      {notice && (
        <section className="app-card-main card-layout">
          <p className="card-body-text">{intl.formatMessage(notice)}</p>
        </section>
      )}
      {data?.available && (
        <ul className="card-list" data-list-layout="choices">
          {data.results?.map((feed) => (
            <li key={feed.id}>
              <article
                className="app-card-sub card-layout"
                data-choice-selected={openId === feed.id}
              >
                <div className="media-fact-row">
                  <h3 className="card-title">{feed.title}</h3>
                  <Badge badgeType="primary">
                    {intl.formatMessage(sourceMessages[feed.source])}
                  </Badge>
                </div>
                {feed.description && (
                  <p className="card-body-text">{feed.description}</p>
                )}
                <p className="card-subheading">
                  {[
                    feed.owner,
                    intl.formatMessage(messages.likes, { count: feed.likes }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="app-action-row">
                  <Button
                    aria-label={`${intl.formatMessage(messages.open)}: ${feed.title}`}
                    buttonType={openId === feed.id ? 'default' : 'primary'}
                    buttonSize="sm"
                    onClick={() => {
                      setOpenId(feed.id);
                      setMore([]);
                      setLess([]);
                    }}
                  >
                    {intl.formatMessage(messages.open)}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {openId && (
        <>
          <section className="app-card-main card-layout">
            <h2 className="card-title">
              {intl.formatMessage(messages.tuning)}
            </h2>
            <fieldset className="choice-group">
              <label className="card-body-text">
                <input
                  type="checkbox"
                  checked={standalones}
                  onChange={(event) =>
                    setStandalones(event.currentTarget.checked)
                  }
                />
                <span>{intl.formatMessage(messages.standalones)}</span>
              </label>
              <label className="card-body-text">
                <input
                  type="checkbox"
                  checked={firstInSeries}
                  onChange={(event) =>
                    setFirstInSeries(event.currentTarget.checked)
                  }
                />
                <span>{intl.formatMessage(messages.firstInSeries)}</span>
              </label>
              <label className="card-body-text">
                <input
                  type="checkbox"
                  checked={lessPopular}
                  onChange={(event) =>
                    setLessPopular(event.currentTarget.checked)
                  }
                />
                <span>{intl.formatMessage(messages.lessPopular)}</span>
              </label>
            </fieldset>
            <div className="filter-field-grid">
              <div className="form-row">
                <label htmlFor="recommendation-include">
                  {intl.formatMessage(messages.includeAuthors)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="recommendation-include"
                      type="text"
                      value={include}
                      onChange={(event) =>
                        setInclude(event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="recommendation-exclude">
                  {intl.formatMessage(messages.excludeAuthors)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="recommendation-exclude"
                      type="text"
                      value={exclude}
                      onChange={(event) =>
                        setExclude(event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <fieldset className="choice-group">
              <legend className="card-subheading">
                {intl.formatMessage(messages.format)}
              </legend>
              {(['ebook', 'audiobook'] as const).map((value) => (
                <label key={value} className="card-body-text">
                  <input
                    type="radio"
                    name="recommendation-format"
                    checked={format === value}
                    onChange={() => setFormat(value)}
                  />
                  <span>
                    {intl.formatMessage(
                      value === 'ebook' ? messages.ebook : messages.audiobook
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          {books && (
            <p className="card-subheading">
              {intl.formatMessage(messages.applied, {
                shown: books.books.length,
                total: books.total,
              })}
            </p>
          )}
          {books && books.books.length === 0 && (
            <section className="app-card-main card-layout">
              <p className="card-body-text">
                {intl.formatMessage(messages.empty)}
              </p>
            </section>
          )}
          <ul className="card-list" data-list-layout="choices">
            {books?.books.map((book) => (
              <li key={book.id}>
                <article className="app-card-sub card-layout media-choice-card">
                  <CoverImage src={book.imageUrl} alt="" />
                  <div data-card-part="body">
                    <h3 className="card-title">{book.title}</h3>
                    <p className="card-subheading">
                      {[book.author, book.year].filter(Boolean).join(' · ')}
                    </p>
                    {book.series && (
                      <p className="card-subheading">
                        {intl.formatMessage(messages.seriesPart, {
                          series: book.series.name,
                          position: book.series.position ?? '?',
                        })}
                      </p>
                    )}
                    <div className="app-action-row">
                      <Button
                        aria-label={`${intl.formatMessage(messages.request)}: ${book.title}`}
                        buttonType="primary"
                        buttonSize="sm"
                        onClick={() => void requestBook(book)}
                      >
                        {intl.formatMessage(messages.request)}
                      </Button>
                      <Button
                        aria-label={`${intl.formatMessage(messages.moreLike)}: ${book.title}`}
                        buttonType={
                          more.includes(book.id) ? 'success' : 'default'
                        }
                        buttonSize="sm"
                        aria-pressed={more.includes(book.id)}
                        onClick={() =>
                          toggle(more, setMore, less, setLess, book.id)
                        }
                      >
                        {intl.formatMessage(messages.moreLike)}
                      </Button>
                      <Button
                        aria-label={`${intl.formatMessage(messages.lessLike)}: ${book.title}`}
                        buttonType={
                          less.includes(book.id) ? 'danger' : 'default'
                        }
                        buttonSize="sm"
                        aria-pressed={less.includes(book.id)}
                        onClick={() =>
                          toggle(less, setLess, more, setMore, book.id)
                        }
                      >
                        {intl.formatMessage(messages.lessLike)}
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>

          <section className="app-card-main card-layout">
            <h2 className="card-title">
              {intl.formatMessage(messages.createHeading)}
            </h2>
            <p className="card-subheading">
              {intl.formatMessage(messages.createHelp)}
            </p>
            <div className="filter-field-grid">
              <div className="form-row">
                <label htmlFor="recommendation-title">
                  {intl.formatMessage(messages.createTitle)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="recommendation-title"
                      type="text"
                      maxLength={120}
                      value={createTitle}
                      onChange={(event) =>
                        setCreateTitle(event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="recommendation-mood">
                  {intl.formatMessage(messages.createMood)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="recommendation-mood"
                      type="text"
                      maxLength={200}
                      value={createMood}
                      onChange={(event) =>
                        setCreateMood(event.currentTarget.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <label className="card-body-text">
              <input
                type="checkbox"
                checked={createFirst}
                onChange={(event) =>
                  setCreateFirst(event.currentTarget.checked)
                }
              />{' '}
              {intl.formatMessage(messages.createFirst)}
            </label>
            <div className="app-action-row">
              <Button
                buttonType="default"
                buttonSize="sm"
                disabled={!createTitle.trim()}
                onClick={() => void create()}
              >
                {intl.formatMessage(messages.create)}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default BookRecommendations;
