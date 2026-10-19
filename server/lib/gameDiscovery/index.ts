import { QuestarrNGAPI } from '@server/api/software/questarrng';
import type {
  GameDiscoverFilters,
  GameDiscoverGame,
} from '@server/api/software/types';
import { getRepository } from '@server/datasource';
import Follow from '@server/entity/Follow';
import FollowEvent from '@server/entity/FollowEvent';
import SavedDiscovery, {
  type SavedDiscoveryFilters,
} from '@server/entity/SavedDiscovery';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export const getQuestarrOrUndefined = (): QuestarrNGAPI | undefined => {
  const settings = getSettings().softwareAcquisition.questarr;
  return settings.hostname && settings.apiKey
    ? new QuestarrNGAPI(settings)
    : undefined;
};

const lower = (values?: string[]) =>
  (values ?? []).map((value) => value.toLowerCase());

const hasAny = (haystack: string[] | undefined, needles?: string[]) =>
  !!needles?.length &&
  lower(haystack).some((value) => lower(needles).includes(value));

export interface GameMatchReason {
  key:
    'theme' | 'mode' | 'perspective' | 'genre' | 'language' | 'short' | 'year';
  values: string[];
}

/** Explains a match using only attributes the catalog actually returned. */
export const explainGameMatch = (
  game: GameDiscoverGame,
  filters: SavedDiscoveryFilters
): GameMatchReason[] => {
  const reasons: GameMatchReason[] = [];
  const overlap = (have: string[] | undefined, want?: string[]) =>
    (have ?? []).filter((value) => lower(want).includes(value.toLowerCase()));

  const pairs: [
    GameMatchReason['key'],
    string[] | undefined,
    string[] | undefined,
  ][] = [
    ['theme', game.themes, filters.themes],
    ['mode', game.gameModes, filters.gameModes],
    ['perspective', game.perspectives, filters.perspectives],
    ['genre', game.genres, filters.genres],
  ];
  for (const [key, have, want] of pairs) {
    const matched = overlap(have, want);
    if (matched.length) reasons.push({ key, values: matched });
  }
  const languages = [
    ...(game.languages?.audio ?? []),
    ...(game.languages?.subtitles ?? []),
    ...(game.languages?.interface ?? []),
  ];
  const matchedLanguages = overlap(languages, filters.languages);
  if (matchedLanguages.length) {
    reasons.push({ key: 'language', values: [...new Set(matchedLanguages)] });
  }
  const hours = game.timeToBeat?.normally ?? game.timeToBeat?.hastily;
  if (filters.maxHoursToBeat && hours && hours <= filters.maxHoursToBeat) {
    reasons.push({ key: 'short', values: [String(Math.round(hours))] });
  }
  const year = Number(game.releaseDate?.slice(0, 4));
  if (filters.minYear && year >= filters.minYear) {
    reasons.push({ key: 'year', values: [String(year)] });
  }
  return reasons;
};

/** Guards against a catalog that ignores exclusions it was sent. */
export const violatesExclusions = (
  game: GameDiscoverGame,
  exclusions?: SavedDiscoveryFilters | null
): boolean =>
  !!exclusions &&
  (hasAny(game.themes, exclusions.themes) ||
    hasAny(game.gameModes, exclusions.gameModes) ||
    hasAny(game.genres, exclusions.genres));

export const toCatalogFilters = (
  filters: SavedDiscoveryFilters,
  exclusions?: SavedDiscoveryFilters | null
): GameDiscoverFilters => ({
  q: filters.text,
  themes: filters.themes,
  gameModes: filters.gameModes,
  perspectives: filters.perspectives,
  genres: filters.genres,
  languages: filters.languages,
  maxHoursToBeat: filters.maxHoursToBeat,
  minYear: filters.minYear,
  excludeThemes: exclusions?.themes,
  excludeGameModes: exclusions?.gameModes,
  excludeGenres: exclusions?.genres,
});

export const runDiscovery = async (
  filters: SavedDiscoveryFilters,
  exclusions: SavedDiscoveryFilters | null | undefined,
  options: { limit?: number; cursor?: string } = {}
) => {
  const api = getQuestarrOrUndefined();
  if (!api) return undefined;
  const page = await api.discoverGames(
    toCatalogFilters(filters, exclusions),
    options.limit ?? 24,
    options.cursor
  );
  const results = page.results
    .filter((game) => !violatesExclusions(game, exclusions))
    .map((game) => ({ game, reasons: explainGameMatch(game, filters) }));
  return { results, nextCursor: page.nextCursor };
};

export const savedDiscoverySubjectKey = (id: number) => `saved:${id}`;

/** Each saved discovery owns a Follow so new matches reach "personal news". */
export const ensureDiscoveryFollow = async (
  discovery: SavedDiscovery
): Promise<Follow> => {
  const repository = getRepository(Follow);
  const key = savedDiscoverySubjectKey(discovery.id);
  const existing = await repository.findOne({
    where: {
      user: { id: discovery.user.id },
      kind: 'saved-discovery',
      subjectKey: key,
    },
  });
  if (existing) {
    existing.subjectLabel = discovery.name.slice(0, 255);
    existing.notify = discovery.notify;
    return repository.save(existing);
  }
  return repository.save(
    repository.create({
      user: discovery.user,
      kind: 'saved-discovery',
      subjectKey: key,
      subjectLabel: discovery.name.slice(0, 255),
      notify: discovery.notify,
      autoRequest: false,
      cursor: null,
    })
  );
};

/** Finds games not shown before and records them as news events. */
export const syncSavedDiscoveries = async (): Promise<void> => {
  if (!getQuestarrOrUndefined()) return;
  const discoveries = await getRepository(SavedDiscovery).find({
    where: { notify: true },
    relations: { user: true },
  });
  for (const discovery of discoveries) {
    try {
      const result = await runDiscovery(
        discovery.filters,
        discovery.exclusions,
        {
          limit: 24,
        }
      );
      if (!result) continue;
      const known = new Set(discovery.knownIds ?? []);
      const fresh = result.results.filter(({ game }) => !known.has(game.id));
      const firstRun = !discovery.lastRunAt;
      if (!firstRun && fresh.length) {
        const follow = await ensureDiscoveryFollow(discovery);
        const eventRepository = getRepository(FollowEvent);
        for (const { game, reasons } of fresh.slice(0, 10)) {
          await eventRepository
            .save(
              eventRepository.create({
                follow,
                user: discovery.user,
                dedupeKey: `game:${game.id}`,
                reasonKey: 'savedDiscoveryMatch',
                reasonValues: {
                  discovery: discovery.name,
                  attributes: reasons
                    .flatMap((reason) => reason.values)
                    .slice(0, 4)
                    .join(', '),
                },
                title: game.title.slice(0, 255),
                imageUrl: game.coverUrl || null,
                target: {
                  mediaType: 'game',
                  id: String(game.igdbId ?? game.id),
                },
                seen: false,
              })
            )
            .catch(() => undefined);
        }
      }
      discovery.knownIds = [
        ...new Set([...known, ...result.results.map(({ game }) => game.id)]),
      ].slice(-500);
      discovery.lastRunAt = new Date();
      await getRepository(SavedDiscovery).save(discovery);
    } catch (error) {
      logger.warn('Saved game discovery failed', {
        label: 'Game Discovery',
        discoveryId: discovery.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
