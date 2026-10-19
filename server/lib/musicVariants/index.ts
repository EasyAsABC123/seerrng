import MusicBrainz, {
  type MusicBrainzEditionRelease,
} from '@server/api/musicbrainz';
import { normalizeTitle } from '@server/lib/resolve/match';

export type MusicEditionKind =
  'standard' | 'deluxe' | 'remaster' | 'expanded' | 'anniversary' | 'other';

export interface MusicVariant {
  releaseId: string;
  title: string;
  disambiguation?: string;
  year?: number;
  country?: string;
  formats: string[];
  edition: MusicEditionKind;
  trackCount: number;
  /** Titles that exist here but not in the standard edition. */
  extraTracks: string[];
  /** Standard-edition titles this edition lacks. */
  missingTracks: string[];
  /** Why this edition was labelled as it was. */
  evidence: string[];
  /** True when it matches the standard edition's track list. */
  isStandard: boolean;
  source: 'musicbrainz' | 'slskdn';
}

const MARKERS: [RegExp, MusicEditionKind][] = [
  [/\bdeluxe\b/i, 'deluxe'],
  [/\bremaster(?:ed)?\b/i, 'remaster'],
  [/\b(expanded|bonus|special)\b/i, 'expanded'],
  [/\b\d+(?:st|nd|rd|th)?\s*anniversary\b|\banniversary\b/i, 'anniversary'],
];

export const labelEdition = (
  ...texts: (string | undefined)[]
): { kind: MusicEditionKind; marker?: string } => {
  const text = texts.filter(Boolean).join(' ');
  for (const [pattern, kind] of MARKERS) {
    const match = text.match(pattern);
    if (match) return { kind, marker: match[0] };
  }
  return { kind: 'other' };
};

/** Standard = fewest tracks among releases with no edition marker. */
const pickStandard = (
  releases: (MusicBrainzEditionRelease & { marker: MusicEditionKind })[]
) => {
  const plain = releases.filter((release) => release.marker === 'other');
  const pool = plain.length ? plain : releases;
  return [...pool].sort((a, b) => a.trackCount - b.trackCount)[0];
};

const trackKey = (title: string) => normalizeTitle(title);

export const compareTrackLists = (
  standard: string[],
  other: string[]
): { extra: string[]; missing: string[] } => {
  const standardKeys = new Set(standard.map(trackKey));
  const otherKeys = new Set(other.map(trackKey));
  return {
    extra: other.filter((title) => !standardKeys.has(trackKey(title))),
    missing: standard.filter((title) => !otherKeys.has(trackKey(title))),
  };
};

const MAX_COMPARED = 6;

/**
 * Compares releases in a release group. MusicBrainz is the source of truth
 * for track lists. slskdN variants add edition evidence from what collectors
 * actually share. Mastering is never inferred from file format.
 */
export const getMusicVariants = async (
  releaseGroupId: string
): Promise<{ variants: MusicVariant[] }> => {
  const musicbrainz = new MusicBrainz();
  const releases = await musicbrainz.getReleaseGroupReleases({
    releaseGroupId,
  });

  // One entry per distinct title + disambiguation + track count.
  const distinct = new Map<
    string,
    MusicBrainzEditionRelease & { marker: MusicEditionKind }
  >();
  for (const release of releases) {
    const key = `${normalizeTitle(release.title)}|${normalizeTitle(release.disambiguation)}|${release.trackCount}`;
    if (!distinct.has(key)) {
      distinct.set(key, {
        ...release,
        marker: labelEdition(release.title, release.disambiguation).kind,
      });
    }
  }
  const candidates = [...distinct.values()];
  const standard = pickStandard(candidates);
  const compare = [
    ...(standard ? [standard] : []),
    ...candidates
      .filter((release) => release.id !== standard?.id)
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, MAX_COMPARED - 1),
  ];

  const tracks = new Map<string, string[]>();
  for (const release of compare) {
    const list = await musicbrainz
      .getReleaseTracks({ releaseId: release.id })
      .catch(() => []);
    tracks.set(
      release.id,
      list.map((track) => track.title)
    );
  }
  const standardTracks = standard ? (tracks.get(standard.id) ?? []) : [];

  const variants: MusicVariant[] = compare.map((release) => {
    const own = tracks.get(release.id) ?? [];
    const isStandard = release.id === standard?.id;
    const diff = isStandard
      ? { extra: [], missing: [] }
      : compareTrackLists(standardTracks, own);
    const label = labelEdition(release.title, release.disambiguation);
    const evidence: string[] = [];
    let edition: MusicEditionKind = isStandard ? 'standard' : label.kind;
    if (label.marker) evidence.push(`Title or note says "${label.marker}"`);
    if (!isStandard && !label.marker && diff.extra.length >= 2) {
      edition = 'expanded';
      evidence.push(
        `${diff.extra.length} more tracks than the standard release`
      );
    }
    if (isStandard) evidence.push('Shortest unmarked release in the group');
    return {
      releaseId: release.id,
      title: release.title,
      disambiguation: release.disambiguation || undefined,
      year: Number(release.date.slice(0, 4)) || undefined,
      country: release.country || undefined,
      formats: release.formats,
      edition,
      trackCount: release.trackCount,
      extraTracks: diff.extra,
      missingTracks: diff.missing,
      evidence,
      isStandard,
      source: 'musicbrainz',
    };
  });

  return { variants };
};
