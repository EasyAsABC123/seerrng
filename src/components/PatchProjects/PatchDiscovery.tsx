import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CoverImage from '@app/components/Common/CoverImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import FollowButton from '@app/components/Following/FollowButton';
import defineMessages from '@app/utils/defineMessages';
import type { PatchProject } from '@server/api/software/types';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.PatchProjects.PatchDiscovery', {
  title: 'Translations and Hacks',
  description:
    'Fan translations, ROM hacks, and quality-of-life patches. Pick the exact version you want, keep the original alongside it, and follow a project for updates.',
  unavailable:
    'The patch catalog needs a ROMarrNG version that includes it. An administrator can connect or update ROMarrNG in Settings → Services.',
  search: 'Search Titles',
  kind: 'Kind',
  anyKind: 'Any Kind',
  translation: 'Translations',
  hack: 'ROM Hacks',
  improvement: 'Improvements',
  language: 'Language',
  anyLanguage: 'Any Language',
  completeOnly: 'Completed projects only',
  none: 'No projects matched.',
  complete: 'Complete',
  partial: 'Partial',
  inProgress: 'In Progress',
  abandoned: 'Abandoned',
  unknownStatus: 'Completeness Unknown',
  latest: 'Latest {version}',
  openGame: 'Choose a Version',
  follow: 'Follow This Project',
  loadMore: 'Load More',
});

const statusMessages = {
  complete: messages.complete,
  partial: messages.partial,
  'in-progress': messages.inProgress,
  abandoned: messages.abandoned,
  unknown: messages.unknownStatus,
} as const;

const gameHref = (project: PatchProject) => {
  const key = project.game.catalogKey;
  if (!key) return `/software?category=retro`;
  return /^dat-/.test(key)
    ? `/software?category=retro&catalogProvider=dat&game=${encodeURIComponent(key)}`
    : `/software?category=retro&game=${encodeURIComponent(key)}`;
};

const PatchDiscovery = () => {
  const intl = useIntl();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [language, setLanguage] = useState('en');
  const [completeOnly, setCompleteOnly] = useState(true);
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (kind) params.set('kind', kind);
  if (language) params.set('language', language);
  if (completeOnly) params.set('completeOnly', 'true');
  const { data } = useSWR<{ available: boolean; results: PatchProject[] }>(
    `/api/v1/patches/search?${params}`
  );

  return (
    <div className="page-layout">
      <PageTitle title={intl.formatMessage(messages.title)} />
      <div className="page-title-row">
        <h1 className="page-title">{intl.formatMessage(messages.title)}</h1>
        {!data && (
          <span className="page-status">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <p className="card-body-text">
        {intl.formatMessage(messages.description)}
      </p>
      {data && !data.available ? (
        <section className="app-card-main card-layout">
          <p className="card-body-text">
            {intl.formatMessage(messages.unavailable)}
          </p>
        </section>
      ) : (
        <>
          <section className="app-card-main card-layout">
            <div className="filter-field-grid">
              <div className="form-row">
                <label htmlFor="patch-q">
                  {intl.formatMessage(messages.search)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <input
                      id="patch-q"
                      type="text"
                      value={q}
                      maxLength={200}
                      onChange={(event) => setQ(event.currentTarget.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="patch-kind">
                  {intl.formatMessage(messages.kind)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <select
                      id="patch-kind"
                      value={kind}
                      onChange={(event) => setKind(event.currentTarget.value)}
                    >
                      <option value="">
                        {intl.formatMessage(messages.anyKind)}
                      </option>
                      <option value="translation">
                        {intl.formatMessage(messages.translation)}
                      </option>
                      <option value="hack">
                        {intl.formatMessage(messages.hack)}
                      </option>
                      <option value="improvement">
                        {intl.formatMessage(messages.improvement)}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="patch-language">
                  {intl.formatMessage(messages.language)}
                </label>
                <div className="form-input-area">
                  <div className="form-input-field">
                    <select
                      id="patch-language"
                      value={language}
                      onChange={(event) =>
                        setLanguage(event.currentTarget.value)
                      }
                    >
                      <option value="">
                        {intl.formatMessage(messages.anyLanguage)}
                      </option>
                      {['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'pl'].map(
                        (code) => (
                          <option key={code} value={code}>
                            {code.toUpperCase()}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <label className="card-body-text">
              <input
                type="checkbox"
                checked={completeOnly}
                onChange={(event) =>
                  setCompleteOnly(event.currentTarget.checked)
                }
              />{' '}
              {intl.formatMessage(messages.completeOnly)}
            </label>
          </section>
          {data?.results.length === 0 && (
            <section className="app-card-main card-layout">
              <p className="card-body-text">
                {intl.formatMessage(messages.none)}
              </p>
            </section>
          )}
          <ul className="card-list" data-list-layout="choices">
            {data?.results.map((project) => (
              <li key={project.id}>
                <article className="app-card-sub card-layout media-choice-card">
                  <CoverImage src={project.coverUrl} alt="" />
                  <div data-card-part="body">
                    <h3 className="card-title">{project.name}</h3>
                    <p className="card-subheading">{project.game.title}</p>
                    <div className="media-fact-row">
                      <Badge badgeType="primary">
                        {project.language?.toUpperCase() ?? project.kind}
                      </Badge>
                      <Badge
                        badgeType={
                          project.status === 'complete'
                            ? 'success'
                            : project.status === 'unknown'
                              ? 'default'
                              : 'warning'
                        }
                      >
                        {intl.formatMessage(statusMessages[project.status])}
                      </Badge>
                    </div>
                    {project.summary && (
                      <p className="card-body-text">{project.summary}</p>
                    )}
                    <p className="card-subheading">
                      {project.versions.length > 0 &&
                        intl.formatMessage(messages.latest, {
                          version:
                            project.versions.find(
                              (version) =>
                                version.id === project.latestVersionId
                            )?.version ?? project.versions[0].version,
                        })}
                    </p>
                    <div className="app-action-row">
                      <Link href={gameHref(project)} legacyBehavior passHref>
                        <Button as="a" buttonType="primary" buttonSize="sm">
                          {intl.formatMessage(messages.openGame)}
                        </Button>
                      </Link>
                      <FollowButton
                        label={intl.formatMessage(messages.follow)}
                        input={{
                          kind: 'patch-project',
                          subjectKey: `patch:${project.id}`,
                          subjectLabel: project.name,
                          conditions: { ref: { projectId: project.id } },
                        }}
                      />
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default PatchDiscovery;
