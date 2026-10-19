import Badge from '@app/components/Common/Badge';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import FollowButton from '@app/components/Following/FollowButton';
import defineMessages from '@app/utils/defineMessages';
import type { PatchProject } from '@server/api/software/types';
import type { SoftwareSelection } from '@server/entity/SoftwareRequest';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.PatchProjects', {
  heading: 'Translations and Hacks',
  loading: 'Checking for patches…',
  none: 'Request the original game',
  original: 'The original game, unmodified',
  keepOriginal: 'Keep the original alongside the patched version',
  version: 'Version',
  latest: 'Latest ({version})',
  baseMissing:
    'The base game this version needs is not available, so it cannot be prepared yet.',
  baseNeeds: 'Needs {region} {revision}',
  translation: 'Translation',
  hack: 'ROM Hack',
  improvement: 'Improvement',
  complete: 'Complete',
  partial: 'Partial',
  inProgress: 'In Progress',
  abandoned: 'Abandoned',
  unknownStatus: 'Completeness Unknown',
  percent: '{percent}% translated',
  by: 'By {author}',
  project: 'Project Page',
  differences: 'What Changes',
  followProject: 'Follow This Project',
  summary: 'What this request gets',
  summaryOriginal: 'The original game.',
  summaryPatch:
    '{name} {version}{keep, select, true { and the unmodified original} other {}}.',
});

const kindMessages = {
  translation: messages.translation,
  hack: messages.hack,
  improvement: messages.improvement,
} as const;

const statusMessages = {
  complete: messages.complete,
  partial: messages.partial,
  'in-progress': messages.inProgress,
  abandoned: messages.abandoned,
  unknown: messages.unknownStatus,
} as const;

interface PatchPickerProps {
  catalogKey: string;
  platformSlug?: string;
  onChange: (selection: SoftwareSelection | null) => void;
}

/** Choose an exact translation or hack version for the selected game. */
export const PatchPicker = ({
  catalogKey,
  platformSlug,
  onChange,
}: PatchPickerProps) => {
  const intl = useIntl();
  const params = new URLSearchParams({ catalogKey });
  if (platformSlug) params.set('platform', platformSlug);
  const { data } = useSWR<{ available: boolean; results: PatchProject[] }>(
    `/api/v1/patches/search?${params}`,
    { revalidateOnFocus: false }
  );
  const [projectId, setProjectId] = useState<string>();
  const [versionId, setVersionId] = useState<string>();
  const [keepOriginal, setKeepOriginal] = useState(true);

  const project = data?.results.find((entry) => entry.id === projectId);
  const version = project?.versions.find(
    (entry) => entry.id === (versionId ?? project.latestVersionId)
  );
  const unprepared = version ? !version.base.available : false;

  useEffect(() => {
    if (!project || unprepared) onChange(null);
    else {
      onChange({
        kind: 'patch',
        projectId: project.id,
        versionId: versionId,
        keepOriginal,
      });
    }
  }, [project, versionId, keepOriginal, unprepared, onChange]);

  if (!data) {
    return (
      <p className="card-subheading" role="status">
        <LoadingSpinner /> {intl.formatMessage(messages.loading)}
      </p>
    );
  }
  if (!data.available || data.results.length === 0) return null;

  return (
    <section className="app-card-inset card-layout">
      <h3 className="card-title">{intl.formatMessage(messages.heading)}</h3>
      <ul className="card-list" data-list-layout="stacked">
        <li>
          <label
            className="app-card-sub card-layout media-choice-card"
            data-choice-selected={!projectId}
            aria-label={intl.formatMessage(messages.original)}
          >
            <input
              type="radio"
              name="patch-project"
              checked={!projectId}
              onChange={() => {
                setProjectId(undefined);
                setVersionId(undefined);
              }}
            />
            <div data-card-part="body">
              <p className="card-title">
                {intl.formatMessage(messages.original)}
              </p>
            </div>
          </label>
        </li>
        {data.results.map((entry) => (
          <li key={entry.id}>
            <label
              className="app-card-sub card-layout media-choice-card"
              data-choice-selected={projectId === entry.id}
            >
              <input
                type="radio"
                name="patch-project"
                checked={projectId === entry.id}
                onChange={() => {
                  setProjectId(entry.id);
                  setVersionId(undefined);
                }}
              />
              <div data-card-part="body">
                <p className="card-title">{entry.name}</p>
                <div className="media-fact-row">
                  <Badge badgeType="primary">
                    {intl.formatMessage(kindMessages[entry.kind])}
                    {entry.language ? ` · ${entry.language.toUpperCase()}` : ''}
                  </Badge>
                  <Badge
                    badgeType={
                      entry.status === 'complete'
                        ? 'success'
                        : entry.status === 'unknown'
                          ? 'default'
                          : 'warning'
                    }
                  >
                    {intl.formatMessage(statusMessages[entry.status])}
                  </Badge>
                  {entry.completeness !== undefined &&
                    entry.status !== 'complete' && (
                      <Badge badgeType="default">
                        {intl.formatMessage(messages.percent, {
                          percent: Math.round(entry.completeness * 100),
                        })}
                      </Badge>
                    )}
                </div>
                {entry.summary && (
                  <p className="card-body-text">{entry.summary}</p>
                )}
                <p className="card-subheading">
                  {[
                    entry.author &&
                      intl.formatMessage(messages.by, { author: entry.author }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {entry.url && /^https?:\/\//.test(entry.url) && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-subheading"
                  >
                    {intl.formatMessage(messages.project)}
                  </a>
                )}
                {projectId === entry.id && (
                  <>
                    {(entry.differences?.length ?? 0) > 0 && (
                      <>
                        <p className="card-subheading">
                          {intl.formatMessage(messages.differences)}
                        </p>
                        <ul>
                          {entry.differences?.map((line) => (
                            <li key={line} className="card-body-text">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="form-row">
                      <label htmlFor={`patch-version-${entry.id}`}>
                        {intl.formatMessage(messages.version)}
                      </label>
                      <div className="form-input-area">
                        <div className="form-input-field">
                          <select
                            id={`patch-version-${entry.id}`}
                            value={versionId ?? ''}
                            onChange={(event) =>
                              setVersionId(
                                event.currentTarget.value || undefined
                              )
                            }
                          >
                            <option value="">
                              {intl.formatMessage(messages.latest, {
                                version:
                                  entry.versions.find(
                                    (v) => v.id === entry.latestVersionId
                                  )?.version ??
                                  entry.versions[0]?.version ??
                                  '',
                              })}
                            </option>
                            {entry.versions.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.version}
                                {v.releasedAt
                                  ? ` · ${v.releasedAt.slice(0, 10)}`
                                  : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    {version && (
                      <p className="card-subheading">
                        {intl.formatMessage(messages.baseNeeds, {
                          region: version.base.region ?? '',
                          revision: version.base.revision ?? '',
                        })}
                        {unprepared &&
                          ` — ${intl.formatMessage(messages.baseMissing)}`}
                      </p>
                    )}
                    <label className="card-body-text">
                      <input
                        type="checkbox"
                        checked={keepOriginal}
                        onChange={(event) =>
                          setKeepOriginal(event.currentTarget.checked)
                        }
                      />{' '}
                      {intl.formatMessage(messages.keepOriginal)}
                    </label>
                    <div className="app-action-row">
                      <FollowButton
                        label={intl.formatMessage(messages.followProject)}
                        input={{
                          kind: 'patch-project',
                          subjectKey: `patch:${entry.id}`,
                          subjectLabel: entry.name,
                          conditions: { ref: { projectId: entry.id } },
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>
      <p className="card-body-text">
        <strong>{intl.formatMessage(messages.summary)}:</strong>{' '}
        {project
          ? intl.formatMessage(messages.summaryPatch, {
              name: project.name,
              version: version?.version ?? '',
              keep: String(keepOriginal),
            })
          : intl.formatMessage(messages.summaryOriginal)}
      </p>
    </section>
  );
};

export default PatchPicker;
