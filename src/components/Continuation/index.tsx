import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import FollowButton from '@app/components/Following/FollowButton';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { Transition } from '@headlessui/react';
import type {
  ContinuationResult,
  ContinuationSource,
} from '@server/lib/continuation';
import type { RequestTarget } from '@server/lib/continuation/targets';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

type SourceView = ContinuationSource & { targets: RequestTarget[] };
type ContinuationResponse =
  | ({ available: true } & Omit<ContinuationResult, 'sources'> & {
        sources: SourceView[];
      })
  | { available: false; reason?: string };

const messages = defineMessages('components.Continuation', {
  button: 'Continue With the Manga or Novels',
  title: 'Continue the Story',
  finished: 'I finished',
  season: 'Season {number}',
  seasonTitled: 'Season {number} · {title}',
  loading: 'Looking for the source material…',
  none: 'No manga or light novel is listed as the source of this series.',
  notAnime: 'This series does not look like an anime with a published source.',
  failed: 'The source material could not be loaded.',
  manga: 'Manga',
  novel: 'Light Novel',
  confidenceHigh: 'Documented',
  confidenceModerate: 'Partly Documented',
  confidenceLow: 'Uncertain',
  confidenceHelp:
    'How well the catalogs document this source and where the season ends. The reasons are listed under Why We Think So.',
  endsAt: 'This season ends at {position} of the source.',
  endUnknown: 'Where this season ends in the source is not documented.',
  continueAt: 'Continue in volume {volume}, starting at chapter {chapter}.',
  continueAtVolume: 'Continue in volume {volume}.',
  continueAtChapter:
    'Continue from chapter {chapter}. The volume that contains it is not documented.',
  continueAfterVolume:
    'The story continues after volume {volume}. Chapter {chapter} may open volume {next}.',
  derivedNote:
    'Worked out from where the season stops, because the catalog does not state the next start.',
  requestVolume: 'Request This Volume',
  requestSeries: 'Request the Series',
  startOver: 'Start From the Beginning',
  searchInstead: 'Search for It',
  followFuture: 'Follow Future Translated Volumes',
  translationPending: 'Volume {volume} has no {language} edition yet.',
  translated: 'Volume {volume} is available in {language}.',
  seasonMappingOrdered:
    'Seasons are matched to the catalog in order. If this series has specials or splits, check the season shown.',
  evidence: 'Why We Think So',
  close: 'Close',
});

const confidenceMessage = {
  high: messages.confidenceHigh,
  moderate: messages.confidenceModerate,
  low: messages.confidenceLow,
} as const;

interface ContinuationModalProps {
  tvId: number;
  seasons: { seasonNumber: number; name?: string }[];
  onClose: () => void;
}

const positionText = (position?: { volume?: number; chapter?: number }) => {
  if (!position) return undefined;
  const parts = [
    position.volume !== undefined ? `Vol. ${position.volume}` : undefined,
    position.chapter !== undefined ? `Ch. ${position.chapter}` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
};

interface ActionEntry {
  target: RequestTarget;
  label: { id: string; defaultMessage: string };
  primary: boolean;
}

const actionsFor = (
  next?: RequestTarget,
  start?: RequestTarget,
  series?: RequestTarget
): ActionEntry[] => {
  const entries: ActionEntry[] = [];
  if (next)
    entries.push({
      target: next,
      label: messages.requestVolume,
      primary: true,
    });
  if (start)
    entries.push({ target: start, label: messages.startOver, primary: !next });
  if (series && !next && !start) {
    entries.push({
      target: series,
      label: series.exact ? messages.requestSeries : messages.searchInstead,
      primary: true,
    });
  }
  return entries;
};

export const ContinuationModal = ({
  tvId,
  seasons,
  onClose,
}: ContinuationModalProps) => {
  const intl = useIntl();
  const [season, setSeason] = useState<number>(
    seasons.at(-1)?.seasonNumber ?? 1
  );
  const language = intl.locale.slice(0, 2);
  const { data, error } = useSWR<ContinuationResponse>(
    `/api/v1/continuation/tv/${tvId}?season=${season}&language=${language}`
  );

  const languageName =
    new Intl.DisplayNames([intl.locale], { type: 'language' }).of(language) ??
    language;

  const continuationLine = (source: SourceView) => {
    const next = source.continuation;
    if (
      source.continuationBasis === 'documented' &&
      next?.volume !== undefined
    ) {
      return next.chapter !== undefined
        ? intl.formatMessage(messages.continueAt, {
            volume: next.volume,
            chapter: next.chapter,
          })
        : intl.formatMessage(messages.continueAtVolume, {
            volume: next.volume,
          });
    }
    if (next?.chapter !== undefined && source.end?.volume !== undefined) {
      return intl.formatMessage(messages.continueAfterVolume, {
        volume: source.end.volume,
        chapter: next.chapter,
        next: source.end.volume + 1,
      });
    }
    if (next?.chapter !== undefined) {
      return intl.formatMessage(messages.continueAtChapter, {
        chapter: next.chapter,
      });
    }
    if (source.novel?.continuationVolume?.sortOrder !== undefined) {
      return intl.formatMessage(messages.continueAtVolume, {
        volume: source.novel.continuationVolume.sortOrder,
      });
    }
    return undefined;
  };

  return (
    <Transition as={Fragment} show>
      <Modal
        manageHistory={false}
        title={intl.formatMessage(messages.title)}
        onCancel={onClose}
        cancelText={intl.formatMessage(globalMessages.close)}
        dialogClass="max-w-2xl"
      >
        <div className="candidate-group">
          <div className="form-row">
            <label htmlFor="continuation-season">
              {intl.formatMessage(messages.finished)}
            </label>
            <div className="form-input-area">
              <div className="form-input-field">
                <select
                  id="continuation-season"
                  value={season}
                  onChange={(event) =>
                    setSeason(Number(event.currentTarget.value))
                  }
                >
                  {seasons.map((entry) => (
                    <option key={entry.seasonNumber} value={entry.seasonNumber}>
                      {intl.formatMessage(messages.season, {
                        number: entry.seasonNumber,
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!data && !error && (
            <p className="card-body-text" role="status">
              <LoadingSpinner /> {intl.formatMessage(messages.loading)}
            </p>
          )}
          {error && (
            <p className="card-body-text">
              {intl.formatMessage(messages.failed)}
            </p>
          )}
          {data && !data.available && (
            <p className="card-body-text">
              {intl.formatMessage(messages.notAnime)}
            </p>
          )}
          {data?.available && data.sources.length === 0 && (
            <p className="card-body-text">
              {intl.formatMessage(messages.none)}
            </p>
          )}
          {data?.available && data.seasonMapping === 'ordered' && (
            <p className="card-subheading">
              {intl.formatMessage(messages.seasonMappingOrdered)}
            </p>
          )}
          {data?.available &&
            data.sources.map((source) => {
              const line = continuationLine(source);
              const start = source.targets.find(
                (target) => target.label === 'start'
              );
              const next = source.targets.find(
                (target) => target.label === 'continuation'
              );
              const series = source.targets.find(
                (target) => target.label === 'series'
              );
              const endText = positionText(source.end);
              return (
                <article
                  key={source.anilistId}
                  className="app-card-sub card-layout media-choice-card"
                >
                  <CoverImage src={source.coverUrl} alt="" />
                  <div data-card-part="body">
                    <div className="media-fact-row">
                      <h3 className="card-title">{source.title}</h3>
                      <Badge badgeType="primary">
                        {intl.formatMessage(
                          source.kind === 'novel'
                            ? messages.novel
                            : messages.manga
                        )}
                      </Badge>
                      <Badge
                        title={intl.formatMessage(messages.confidenceHelp)}
                        badgeType={
                          source.confidence === 'high'
                            ? 'success'
                            : source.confidence === 'moderate'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {intl.formatMessage(
                          confidenceMessage[source.confidence]
                        )}
                      </Badge>
                    </div>
                    <p className="card-body-text">
                      {endText
                        ? intl.formatMessage(messages.endsAt, {
                            position: endText,
                          })
                        : intl.formatMessage(messages.endUnknown)}
                    </p>
                    {line && (
                      <p className="card-body-text">
                        <strong>{line}</strong>
                      </p>
                    )}
                    {source.continuationBasis === 'derived' && (
                      <p className="card-subheading">
                        {intl.formatMessage(messages.derivedNote)}
                      </p>
                    )}
                    {source.novel?.continuationVolume && (
                      <p className="card-body-text">
                        {intl.formatMessage(
                          source.novel.translationPending
                            ? messages.translationPending
                            : messages.translated,
                          {
                            volume:
                              source.novel.continuationVolume.sortOrder ?? '',
                            language: languageName,
                          }
                        )}
                      </p>
                    )}
                    <div className="app-action-row">
                      {actionsFor(next, start, series).map((entry) => (
                        <Link
                          key={entry.target.href}
                          href={entry.target.href}
                          legacyBehavior
                          passHref
                        >
                          <Button
                            as="a"
                            buttonType={entry.primary ? 'primary' : 'default'}
                            buttonSize="sm"
                          >
                            {intl.formatMessage(entry.label)}
                          </Button>
                        </Link>
                      ))}
                      {source.novel && (
                        <FollowButton
                          label={intl.formatMessage(messages.followFuture)}
                          input={{
                            kind: 'series-language',
                            subjectKey: `ranobedb:${source.novel.ranobedbId}:${language}`,
                            subjectLabel: source.title,
                            conditions: {
                              language,
                              ref: { ranobedbId: source.novel.ranobedbId },
                            },
                          }}
                        />
                      )}
                    </div>
                    <details>
                      <summary className="card-subheading">
                        {intl.formatMessage(messages.evidence)}
                      </summary>
                      <ul>
                        {source.evidence.map((line) => (
                          <li key={line} className="card-subheading">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </article>
              );
            })}
        </div>
      </Modal>
    </Transition>
  );
};

export const ContinuationButton = ({
  tvId,
  seasons,
}: Omit<ContinuationModalProps, 'onClose'>) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        buttonType="association"
        buttonSize="sm"
        onClick={() => setOpen(true)}
      >
        {intl.formatMessage(messages.button)}
      </Button>
      {open && (
        <ContinuationModal
          tvId={tvId}
          seasons={seasons}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default ContinuationButton;
