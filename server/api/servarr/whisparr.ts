import type { DVRSettings } from '@server/lib/settings';
import { normalizeStashDbId } from '@server/lib/stashdbIdentity';
import ServarrBase, {
  MAX_SERVARR_LIBRARY_RESPONSE_BYTES,
  MAX_SERVARR_LIBRARY_RESULTS,
  MAX_SERVARR_LOOKUP_RESULTS,
  sanitizeServarrRecordArray,
} from './base';

const MAX_SCENE_TEXT_LENGTH = 10_000;
const MAX_SCENE_LOOKUP_RESULTS = 200;
const MAX_SCENE_TAGS = 1_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_SCENE_TEXT_LENGTH).trim() : '';
const integer = (value: unknown): number =>
  Number.isSafeInteger(value) ? (value as number) : 0;

export interface WhisparrScene {
  id: number;
  foreignId: string;
  title: string;
  year?: number;
  overview?: string;
  studio?: string;
  monitored: boolean;
  hasFile: boolean;
  path?: string;
  tags: number[];
}

export type WhisparrSceneLookup = Pick<
  WhisparrScene,
  'foreignId' | 'title' | 'year' | 'overview' | 'studio'
>;

export interface WhisparrAddSceneOptions {
  foreignId: string;
  title: string;
  year?: number;
  qualityProfileId: number;
  rootFolderPath: string;
  tags: number[];
  monitored: boolean;
  searchNow: boolean;
}

const sanitizeScene = (value: unknown): WhisparrScene | undefined => {
  if (!isRecord(value)) return undefined;
  const foreignId = normalizeStashDbId(value.foreignId);
  const title = text(value.title);
  const id = integer(value.id);
  if (!foreignId || !title || id <= 0) return undefined;

  return {
    id,
    foreignId,
    title,
    year: integer(value.year) || undefined,
    overview: text(value.overview) || undefined,
    studio: text(value.studio) || undefined,
    monitored: value.monitored === true,
    hasFile: value.hasFile === true,
    path: text(value.path) || undefined,
    tags: (Array.isArray(value.tags) ? value.tags : [])
      .slice(0, MAX_SCENE_TAGS)
      .filter((tag): tag is number => Number.isSafeInteger(tag)),
  };
};

const sanitizeLookup = (value: unknown): WhisparrSceneLookup | undefined => {
  if (!isRecord(value)) return undefined;
  const foreignId = normalizeStashDbId(value.foreignId);
  const title = text(value.title);
  if (!foreignId || !title) return undefined;

  return {
    foreignId,
    title,
    year: integer(value.year) || undefined,
    overview: text(value.overview) || undefined,
    studio: text(value.studio) || undefined,
  };
};

class WhisparrAPI extends ServarrBase<{ movieId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'whisparr', apiName: 'Whisparr' });
  }

  public searchScenes = async (
    term: string
  ): Promise<WhisparrSceneLookup[]> => {
    const normalizedTerm = term.trim().slice(0, 200);
    if (!normalizedTerm) return [];

    const response = await this.request<unknown>(
      'GET',
      '/movie/lookup',
      undefined,
      {
        params: { term: normalizedTerm, itemType: 'scene' },
        maxContentLength: MAX_SERVARR_LIBRARY_RESPONSE_BYTES,
      }
    );
    if (!Array.isArray(response.data)) {
      throw new Error('[Whisparr] Scene lookup returned an invalid response.');
    }

    return sanitizeServarrRecordArray<Record<string, unknown>>(
      response.data,
      Math.min(MAX_SERVARR_LOOKUP_RESULTS, MAX_SCENE_LOOKUP_RESULTS)
    ).flatMap((scene) => {
      if (scene.itemType && scene.itemType !== 'scene') return [];
      const normalized = sanitizeLookup(scene);
      return normalized ? [normalized] : [];
    });
  };

  public getSceneByStashDbId = async (
    stashDbId: string
  ): Promise<WhisparrSceneLookup | undefined> => {
    const normalizedId = normalizeStashDbId(stashDbId);
    if (!normalizedId) return undefined;
    return (await this.searchScenes(normalizedId)).find(
      (scene) => scene.foreignId === normalizedId
    );
  };

  public getScenes = async (): Promise<WhisparrScene[]> => {
    const response = await this.request<unknown>('GET', '/movie', undefined, {
      maxContentLength: MAX_SERVARR_LIBRARY_RESPONSE_BYTES,
    });
    if (
      !Array.isArray(response.data) ||
      response.data.length > MAX_SERVARR_LIBRARY_RESULTS
    ) {
      throw new Error(
        '[Whisparr] Scene inventory returned an invalid response.'
      );
    }
    return sanitizeServarrRecordArray<Record<string, unknown>>(
      response.data,
      MAX_SERVARR_LIBRARY_RESULTS
    ).flatMap((scene) => {
      const normalized = sanitizeScene(scene);
      return normalized ? [normalized] : [];
    });
  };

  public addScene = async (
    options: WhisparrAddSceneOptions
  ): Promise<WhisparrScene> => {
    const foreignId = normalizeStashDbId(options.foreignId);
    if (!foreignId) throw new Error('A valid StashDB scene ID is required.');

    const scenes = await this.getScenes();
    const existing = scenes.find((scene) => scene.foreignId === foreignId);
    if (existing?.hasFile) return existing;

    const body = {
      ...(existing ? { ...existing, id: existing.id } : {}),
      title: options.title,
      foreignId,
      year: options.year,
      qualityProfileId: options.qualityProfileId,
      rootFolderPath: options.rootFolderPath,
      monitored: options.monitored,
      tags: [...new Set([...(existing?.tags ?? []), ...options.tags])],
      itemType: 'scene',
      addOptions: { searchForMovie: options.searchNow },
    };

    if (existing) {
      if (!existing.monitored || options.searchNow) {
        const response = await this.request<unknown>('PUT', '/movie', body);
        return this.requireSavedScene(response.data, foreignId, options.title);
      }
      return existing;
    }

    const response = await this.request<unknown>('POST', '/movie', body);
    return this.requireSavedScene(response.data, foreignId, options.title);
  };

  private requireSavedScene(
    value: unknown,
    foreignId: string,
    title: string
  ): WhisparrScene {
    const normalized = sanitizeScene(
      isRecord(value)
        ? {
            ...value,
            foreignId: value.foreignId ?? foreignId,
            title: value.title ?? title,
          }
        : value
    );
    if (!normalized)
      throw new Error('[Whisparr] Failed to accept the scene request.');
    return normalized;
  }

  public static buildUrl(
    settings: Pick<DVRSettings, 'useSsl' | 'hostname' | 'port' | 'baseUrl'>,
    path?: string
  ): string {
    return super.buildUrl(settings, path);
  }
}

export default WhisparrAPI;
