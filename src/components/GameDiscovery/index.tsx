import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import {
  GAME_LANGUAGES,
  GAME_MODES,
  GAME_PERSPECTIVES,
  GAME_THEMES,
} from '@app/components/GameDiscovery/facets';
import useToasts from '@app/hooks/useToasts';
import defineMessages from '@app/utils/defineMessages';
import type { GameDiscoverGame } from '@server/api/software/types';
import type { SavedDiscoveryFilters } from '@server/entity/SavedDiscovery';
import type { GameMatchReason } from '@server/lib/gameDiscovery';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

interface DiscoverResult {
  game: GameDiscoverGame;
  reasons: GameMatchReason[];
}

interface DiscoverResponse {
  available: boolean;
  results: DiscoverResult[];
  nextCursor?: string | null;
}

interface SavedDiscoveryView {
  id: number;
  name: string;
  filters: SavedDiscoveryFilters;
  exclusions: SavedDiscoveryFilters | null;
  notify: boolean;
}

const messages = defineMessages('components.GameDiscovery', {
  title: 'Game Finder',
  description:
    'Describe the kind of game you want and keep it as a saved search. New matches show up on your Following page.',
  unavailable:
    'Game discovery needs QuestarrNG. An administrator can connect it in Settings → Services.',
  keywords: 'Keywords',
  keywordsPlaceholder: 'for example: crafting, base building',
  themes: 'Themes',
  modes: 'Game Modes',
  perspectives: 'Perspectives',
  languages: 'Languages',
  exclude: 'Leave Out',
  excludeThemes: 'Leave out these themes',
  maxHours: 'Short Games Only (Hours to Beat)',
  anyLength: 'Any Length',
  minYear: 'Released Since',
  search: 'Find Games',
  searching: 'Searching…',
  results: 'Matches',
  noResults: 'No games matched. Loosen a filter and try again.',
  chooseFilter: 'Choose at least one filter.',
  why: 'Why it matched',
  reasonTheme: 'Themes: {values}',
  reasonMode: 'Modes: {values}',
  reasonPerspective: 'Perspective: {values}',
  reasonGenre: 'Genres: {values}',
  reasonLanguage: 'Languages: {values}',
  reasonShort: 'About {values} hours to beat',
  reasonYear: 'Released {values}',
  request: 'Open to Request',
  saveHeading: 'Save This Search',
  saveName: 'Name',
  saveNotify: 'Tell me about new matches',
  save: 'Save Search',
  saved: 'Saved “{name}”.',
  saveFailed: 'The search could not be saved.',
  savedHeading: 'Saved Searches',
  none: 'No saved searches yet.',
  run: 'Show Matches',
  remove: 'Delete',
  loadMore: 'Load More',
  failed: 'Game discovery is unavailable right now.',
});

const reasonMessages = {
  theme: messages.reasonTheme,
  mode: messages.reasonMode,
  perspective: messages.reasonPerspective,
  genre: messages.reasonGenre,
  language: messages.reasonLanguage,
  short: messages.reasonShort,
  year: messages.reasonYear,
} as const;

const FacetGroup = ({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) => (
  <fieldset className="choice-group">
    <legend className="card-subheading">{legend}</legend>
    <div className="media-fact-row">
      {options.map((option) => (
        <label key={option} className="card-body-text">
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={(event) =>
              onChange(
                event.currentTarget.checked
                  ? [...value, option]
                  : value.filter((entry) => entry !== option)
              )
            }
          />{' '}
          {option}
        </label>
      ))}
    </div>
  </fieldset>
);

const hasFilters = (filters: SavedDiscoveryFilters) =>
  Object.values(filters).some((entry) =>
    Array.isArray(entry)
      ? entry.length > 0
      : entry !== undefined && entry !== ''
  );

const GameDiscovery = () => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const [text, setText] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [perspectives, setPerspectives] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [excludeThemes, setExcludeThemes] = useState<string[]>([]);
  const [maxHours, setMaxHours] = useState('');
  const [minYear, setMinYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<DiscoverResult[]>();
  const [cursor, setCursor] = useState<string | null>();
  const [available, setAvailable] = useState(true);
  const [name, setName] = useState('');
  const [notify, setNotify] = useState(true);
  const { data: saved, mutate } = useSWR<{ results: SavedDiscoveryView[] }>(
    '/api/v1/game-content/saved'
  );

  const filters = (): SavedDiscoveryFilters => ({
    text: text.trim() || undefined,
    themes,
    gameModes: modes,
    perspectives,
    languages,
    maxHoursToBeat: maxHours ? Number(maxHours) : undefined,
    minYear: minYear ? Number(minYear) : undefined,
  });
  const exclusions = (): SavedDiscoveryFilters => ({ themes: excludeThemes });

  const run = async (
    body: {
      filters: SavedDiscoveryFilters;
      exclusions?: SavedDiscoveryFilters;
    },
    more = false
  ) => {
    setBusy(true);
    try {
      const response = await axios.post<DiscoverResponse>(
        '/api/v1/game-content/discover',
        {
          ...body,
          cursor: more ? cursor : undefined,
        }
      );
      setAvailable(response.data.available);
      setResults((current) => [
        ...(more ? (current ?? []) : []),
        ...response.data.results,
      ]);
      setCursor(response.data.nextCursor);
    } catch {
      addToast(intl.formatMessage(messages.failed), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      await axios.post('/api/v1/game-content/saved', {
        name,
        filters: filters(),
        exclusions: exclusions(),
        notify,
      });
      addToast(intl.formatMessage(messages.saved, { name }), {
        appearance: 'success',
        autoDismiss: true,
      });
      setName('');
      await mutate();
    } catch {
      addToast(intl.formatMessage(messages.saveFailed), {
        appearance: 'error',
        autoDismiss: true,
      });
    }
  };

  const load = (entry: SavedDiscoveryView) => {
    setText(entry.filters.text ?? '');
    setThemes(entry.filters.themes ?? []);
    setModes(entry.filters.gameModes ?? []);
    setPerspectives(entry.filters.perspectives ?? []);
    setLanguages(entry.filters.languages ?? []);
    setExcludeThemes(entry.exclusions?.themes ?? []);
    setMaxHours(
      entry.filters.maxHoursToBeat ? String(entry.filters.maxHoursToBeat) : ''
    );
    setMinYear(entry.filters.minYear ? String(entry.filters.minYear) : '');
    void run({
      filters: entry.filters,
      exclusions: entry.exclusions ?? undefined,
    });
  };

  const canSearch = hasFilters(filters());

  return (
    <div className="page-layout">
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="page-title-row">
        <h1 className="page-title">{intl.formatMessage(messages.title)}</h1>
        {busy && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <p className="card-body-text">
        {intl.formatMessage(messages.description)}
      </p>

      {!available ? (
        <section className="app-card-main card-layout">
          <p className="card-body-text">
            {intl.formatMessage(messages.unavailable)}
          </p>
        </section>
      ) : (
        <section className="app-card-main card-layout">
          <div className="filter-field-grid">
            <div className="form-row">
              <label htmlFor="game-keywords">
                {intl.formatMessage(messages.keywords)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <input
                    id="game-keywords"
                    type="text"
                    maxLength={200}
                    value={text}
                    placeholder={intl.formatMessage(
                      messages.keywordsPlaceholder
                    )}
                    onChange={(event) => setText(event.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="game-hours">
                {intl.formatMessage(messages.maxHours)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <select
                    id="game-hours"
                    value={maxHours}
                    onChange={(event) => setMaxHours(event.currentTarget.value)}
                  >
                    <option value="">
                      {intl.formatMessage(messages.anyLength)}
                    </option>
                    {[3, 5, 8, 12, 20].map((hours) => (
                      <option key={hours} value={hours}>
                        ≤ {hours}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="game-year">
                {intl.formatMessage(messages.minYear)}
              </label>
              <div className="form-input-area">
                <div className="form-input-field">
                  <input
                    id="game-year"
                    type="number"
                    min={1970}
                    max={2100}
                    value={minYear}
                    onChange={(event) => setMinYear(event.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <FacetGroup
            legend={intl.formatMessage(messages.themes)}
            options={GAME_THEMES}
            value={themes}
            onChange={setThemes}
          />
          <FacetGroup
            legend={intl.formatMessage(messages.modes)}
            options={GAME_MODES}
            value={modes}
            onChange={setModes}
          />
          <FacetGroup
            legend={intl.formatMessage(messages.perspectives)}
            options={GAME_PERSPECTIVES}
            value={perspectives}
            onChange={setPerspectives}
          />
          <FacetGroup
            legend={intl.formatMessage(messages.languages)}
            options={GAME_LANGUAGES}
            value={languages}
            onChange={setLanguages}
          />
          <FacetGroup
            legend={intl.formatMessage(messages.excludeThemes)}
            options={GAME_THEMES}
            value={excludeThemes}
            onChange={setExcludeThemes}
          />
          <div className="app-action-row">
            <Button
              type="button"
              buttonType="primary"
              buttonSize="sm"
              disabled={busy || !canSearch}
              onClick={() =>
                void run({ filters: filters(), exclusions: exclusions() })
              }
            >
              {intl.formatMessage(busy ? messages.searching : messages.search)}
            </Button>
          </div>
          {!canSearch && (
            <p className="card-subheading">
              {intl.formatMessage(messages.chooseFilter)}
            </p>
          )}
        </section>
      )}

      {results && (
        <>
          <h2 className="page-heading">
            {intl.formatMessage(messages.results)}
          </h2>
          {results.length === 0 ? (
            <section className="app-card-main card-layout">
              <p className="card-body-text">
                {intl.formatMessage(messages.noResults)}
              </p>
            </section>
          ) : (
            <ul className="card-list" data-list-layout="choices">
              {results.map(({ game, reasons }) => (
                <li key={game.id}>
                  <article className="app-card-sub card-layout media-choice-card">
                    <CoverImage src={game.coverUrl} alt="" />
                    <div data-card-part="body">
                      <h3 className="card-title">{game.title}</h3>
                      <p className="card-subheading">
                        {[game.releaseDate?.slice(0, 4), game.developers?.[0]]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {reasons.length > 0 && (
                        <>
                          <p className="card-subheading">
                            {intl.formatMessage(messages.why)}
                          </p>
                          <div className="media-fact-row">
                            {reasons.map((reason) => (
                              <Badge key={reason.key} badgeType="association">
                                {intl.formatMessage(
                                  reasonMessages[reason.key],
                                  {
                                    values: reason.values.join(', '),
                                  }
                                )}
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="app-action-row">
                        <Link
                          href={`/software?category=game&game=${game.igdbId ?? game.id}`}
                          legacyBehavior
                          passHref
                        >
                          <Button as="a" buttonType="primary" buttonSize="sm">
                            {intl.formatMessage(messages.request)}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <div className="app-action-row">
              <Button
                buttonType="default"
                buttonSize="sm"
                disabled={busy}
                onClick={() =>
                  void run(
                    { filters: filters(), exclusions: exclusions() },
                    true
                  )
                }
              >
                {intl.formatMessage(messages.loadMore)}
              </Button>
            </div>
          )}
          {canSearch && (
            <section className="app-card-main card-layout">
              <h2 className="card-title">
                {intl.formatMessage(messages.saveHeading)}
              </h2>
              <div className="form-row">
                <label htmlFor="game-save-name">
                  {intl.formatMessage(messages.saveName)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="game-save-name"
                      type="text"
                      maxLength={120}
                      value={name}
                      onChange={(event) => setName(event.currentTarget.value)}
                    />
                  </div>
                </div>
              </div>
              <label className="card-body-text">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(event) => setNotify(event.currentTarget.checked)}
                />{' '}
                {intl.formatMessage(messages.saveNotify)}
              </label>
              <div className="app-action-row">
                <Button
                  buttonType="primary"
                  buttonSize="sm"
                  disabled={!name.trim()}
                  onClick={() => void save()}
                >
                  {intl.formatMessage(messages.save)}
                </Button>
              </div>
            </section>
          )}
        </>
      )}

      <h2 className="page-heading">
        {intl.formatMessage(messages.savedHeading)}
      </h2>
      {saved && saved.results.length === 0 ? (
        <section className="app-card-main card-layout">
          <p className="card-body-text">{intl.formatMessage(messages.none)}</p>
        </section>
      ) : (
        <ul className="card-list" data-list-layout="stacked">
          {saved?.results.map((entry) => (
            <li key={entry.id}>
              <article className="app-card-sub card-layout">
                <h3 className="card-title">{entry.name}</h3>
                <div className="media-fact-row">
                  {[
                    ...(entry.filters.themes ?? []),
                    ...(entry.filters.gameModes ?? []),
                    ...(entry.filters.perspectives ?? []),
                    ...(entry.filters.languages ?? []),
                    ...(entry.filters.text ? [entry.filters.text] : []),
                  ].map((value) => (
                    <Badge key={value} badgeType="default">
                      {value}
                    </Badge>
                  ))}
                  {(entry.exclusions?.themes ?? []).map((value) => (
                    <Badge key={`not-${value}`} badgeType="danger">
                      − {value}
                    </Badge>
                  ))}
                </div>
                <div className="app-action-row">
                  <Button
                    buttonType="primary"
                    buttonSize="sm"
                    onClick={() => load(entry)}
                  >
                    {intl.formatMessage(messages.run)}
                  </Button>
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    onClick={() =>
                      void axios
                        .delete(`/api/v1/game-content/saved/${entry.id}`)
                        .then(() => mutate())
                    }
                  >
                    {intl.formatMessage(messages.remove)}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GameDiscovery;
