import type { SoftwareProviderSettings } from '@server/lib/settings';

export type SoftwareProviderConnection = SoftwareProviderSettings;

export interface SoftwareProviderCapabilities {
  catalog: boolean;
  datCatalog?: boolean;
  pcAcquisition: boolean;
  emulationAcquisition: boolean;
  requestActions: { retry: boolean; cancel: boolean };
  assetStreaming: boolean;
  assetBundles?: boolean;
}

export interface SoftwareProviderHandshake {
  service: string;
  version?: string;
  apiVersion: number;
  requestContractVersion?: number;
  capabilities?: SoftwareProviderCapabilities;
}

export interface SoftwareProviderActions {
  retry: boolean;
  cancel: boolean;
  cancelReason?: string;
}

export interface SoftwareCatalogGame {
  id: string;
  catalogProvider?: 'igdb' | 'dat';
  catalogId?: string;
  igdbId?: number;
  title: string;
  summary: string;
  coverUrl: string;
  releaseDate: string;
  /** Exact day-precision release for the requested IGDB platform, when asked. */
  platformReleaseDate?: string | null;
  platforms: string[];
  platformOptions: { id?: number; key?: string; name: string }[];
  genres: string[];
  /** Steam App ID from the IGDB Steam store link, when available. */
  steamAppId?: number | null;
  rating?: number | null;
  publishers?: string[];
  developers?: string[];
  screenshots?: string[];
  videos?: { name: string; videoId: string }[];
  timeToBeat?: {
    hastily?: number;
    normally?: number;
    completely?: number;
  } | null;
  source?: 'IGDB' | 'DAT';
  dat?: {
    name: string;
    version: string;
    entry: string;
    variants: number;
  };
}

export interface SoftwareCatalogPlatform {
  id: number;
  name: string;
}

export interface SoftwareDatCatalogPlatform {
  slug: string;
  name: string;
  gameCount: number;
}

export interface SoftwareDatCatalogPlatformsResponse {
  results: SoftwareDatCatalogPlatform[];
  unmatchedDatNames: string[];
}

export interface SoftwareAsset {
  id: string;
  name: string;
  size: number;
  url: string;
  /**
   * ROMarrNG DAT verdict: true matches the loaded DAT, false is hashed but
   * not in it, undefined when unknown or not reported.
   */
  datVerified?: boolean;
}

export interface SoftwareAssetsResponse {
  assets: SoftwareAsset[];
  bundleSupported: boolean;
  bundleName?: string;
}

export type PcOperatingSystem = 'windows' | 'linux' | 'macos';
export type PcArchitecture = 'x64' | 'arm64' | 'x86' | 'universal';

export interface PcGameVariant {
  operatingSystem: PcOperatingSystem;
  architecture: PcArchitecture;
}

export type SoftwareProviderStatus =
  | 'accepted'
  | 'searching'
  | 'downloading'
  | 'importing'
  | 'available'
  | 'failed'
  | 'cancelled';

/**
 * Whether ROMarrNG has placed the finished file in a library folder that RomM
 * reads. `placed` does not mean RomM has indexed the file.
 */
export interface SoftwareProviderRomPlacement {
  placed: boolean;
  library: string | null;
  layout: 'flat' | 'nested' | null;
}

export interface SoftwareProviderRequest {
  externalRequestId: string;
  status: SoftwareProviderStatus;
  stage?: string | null;
  percent?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  deliverable: boolean;
  rommPlacement?: SoftwareProviderRomPlacement | null;
  error?: string | null;
  title?: string;
  game?: { id: string; title: string; status: string } | null;
  variant?: PcGameVariant;
  platform?: string;
  identity?: {
    catalogProvider: string;
    catalogId?: number;
    catalogKey?: string;
    platformId?: number;
    platformSlug?: string;
  } | null;
  actions?: SoftwareProviderActions | null;
}

export type GameContentType =
  | 'expansion'
  | 'dlc'
  | 'cosmetic'
  | 'season-pass'
  | 'bonus'
  | 'soundtrack'
  | 'unknown';

/** One piece of content a game edition may include. */
export interface GameContentItem {
  igdbId: number;
  title: string;
  type: GameContentType;
  /** True for story content, false for cosmetic, null when the catalog is silent. */
  storyContent: boolean | null;
  releaseDate?: string;
  coverUrl?: string;
  /** The library already holds this content. */
  owned: boolean;
}

export interface GameEdition {
  igdbId: number;
  title: string;
  summary?: string;
  releaseDate?: string;
  includes: GameContentItem[];
  /** False when the catalog does not say what the edition contains. */
  contentKnown: boolean;
  owned: boolean;
}

export interface GameEditionsResponse {
  base: { igdbId: number; title: string; owned: boolean; status?: string };
  editions: GameEdition[];
  /** Expansions and add-ons that can be requested on their own. */
  addons: GameContentItem[];
}

export interface GameDiscoverFilters {
  q?: string;
  themes?: string[];
  gameModes?: string[];
  perspectives?: string[];
  genres?: string[];
  languages?: string[];
  excludeThemes?: string[];
  excludeGameModes?: string[];
  excludeGenres?: string[];
  maxHoursToBeat?: number;
  minYear?: number;
}

export interface GameDiscoverGame extends SoftwareCatalogGame {
  themes?: string[];
  gameModes?: string[];
  perspectives?: string[];
  languages?: { audio?: string[]; subtitles?: string[]; interface?: string[] };
}

export interface GameDiscoverPage {
  results: GameDiscoverGame[];
  nextCursor: string | null;
}

export interface PatchVersion {
  id: string;
  version: string;
  releasedAt?: string;
  notes?: string;
  /** Hash-pinned base revision the patch applies to. */
  base: {
    region?: string;
    revision?: string;
    sha1?: string;
    available: boolean;
  };
  patchFormat?: 'ips' | 'bps' | 'ups' | 'xdelta' | 'ppf' | 'other';
}

export interface PatchProject {
  id: string;
  name: string;
  kind: 'translation' | 'hack' | 'improvement';
  /** Target language for translations. */
  language?: string;
  status: 'complete' | 'partial' | 'in-progress' | 'abandoned' | 'unknown';
  /** 0..1 when the project reports it. Never inferred from file names. */
  completeness?: number;
  summary?: string;
  author?: string;
  url?: string;
  game: { catalogKey?: string; title: string; platformSlug?: string };
  differences?: string[];
  versions: PatchVersion[];
  latestVersionId?: string;
  coverUrl?: string;
}

export interface PatchSearchPage {
  results: PatchProject[];
  nextCursor: string | null;
}

export interface PatchSearchFilters {
  q?: string;
  platformSlug?: string;
  kind?: PatchProject['kind'];
  language?: string;
  completeOnly?: boolean;
  catalogKey?: string;
}
