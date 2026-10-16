import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import { getPositiveQueryParamNumber } from '@app/hooks/useUpdateQueryParams';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import {
  MOVIE_MATURITY_LIMITS,
  TV_MATURITY_LIMITS,
} from '@server/constants/videoMaturity';
import type { UserVideoMaturityPolicyResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState, type FormEvent } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserMaturityControls',
  {
    title: 'Maturity Controls',
    description:
      'Set the highest US movie and TV ratings this user can browse or request.',
    protectionNote:
      'Limits apply to title details, search, discovery, and new or edited requests. When a limit is set, titles with missing or unrecognized US ratings are blocked.',
    movieLabel: 'Movie Rating Limit',
    movieHelp: 'Only movies with this US rating or a lower rating are allowed.',
    movieNone: 'No Limit',
    movieG: 'G',
    moviePg: 'PG',
    moviePg13: 'PG-13',
    movieR: 'R',
    movieNc17: 'NC-17',
    tvLabel: 'TV Rating Limit',
    tvHelp: 'Only series with this US rating or a lower rating are allowed.',
    tvNone: 'No Limit',
    tvY: 'TV-Y',
    tvY7: 'TV-Y7',
    tvG: 'TV-G',
    tvPg: 'TV-PG',
    tv14: 'TV-14',
    tvMa: 'TV-MA',
    save: 'Save Changes',
    saving: 'Saving…',
    saved: 'Maturity limits saved.',
    saveFailure: 'Unable to save maturity limits.',
  }
);

const UserMaturityControls = () => {
  const router = useRouter();
  const intl = useIntl();
  const userId = getPositiveQueryParamNumber(router.query.userId);
  const endpoint = userId ? `/api/v1/user/${userId}/settings/maturity` : null;
  const { data, error, mutate } =
    useSWR<UserVideoMaturityPolicyResponse>(endpoint);
  const [movieLimit, setMovieLimit] = useState('');
  const [tvLimit, setTvLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMovieLimit(data.movieMaturityRatingLimit ?? '');
    setTvLimit(data.tvMaturityRatingLimit ?? '');
  }, [data]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!endpoint) return;

    setSaving(true);
    setSaved(false);
    setSaveFailed(false);
    try {
      const response = await axios.post<UserVideoMaturityPolicyResponse>(
        endpoint,
        {
          movieMaturityRatingLimit: movieLimit || null,
          tvMaturityRatingLimit: tvLimit || null,
        }
      );
      await mutate(response.data, false);
      setMovieLimit(response.data.movieMaturityRatingLimit ?? '');
      setTvLimit(response.data.tvMaturityRatingLimit ?? '');
      setSaved(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return <ErrorPage statusCode={404} />;
  }
  if (!data && error) {
    return <ErrorPage statusCode={500} />;
  }
  if (!data) {
    return <LoadingSpinner />;
  }

  return (
    <section className="section">
      <h3 className="heading">{intl.formatMessage(messages.title)}</h3>
      <p className="description">{intl.formatMessage(messages.description)}</p>
      <Alert type="info" title={intl.formatMessage(messages.protectionNote)} />

      <form onSubmit={save}>
        <div className="form-row">
          <label htmlFor="movie-maturity-limit">
            {intl.formatMessage(messages.movieLabel)}
          </label>
          <div className="form-input-area">
            <select
              id="movie-maturity-limit"
              value={movieLimit}
              onChange={(event) => {
                setMovieLimit(event.target.value);
                setSaved(false);
              }}
              disabled={saving}
            >
              <option value="">{intl.formatMessage(messages.movieNone)}</option>
              {MOVIE_MATURITY_LIMITS.map((rating) => {
                const label = {
                  G: messages.movieG,
                  PG: messages.moviePg,
                  'PG-13': messages.moviePg13,
                  R: messages.movieR,
                  'NC-17': messages.movieNc17,
                }[rating];
                return (
                  <option key={rating} value={rating}>
                    {intl.formatMessage(label)}
                  </option>
                );
              })}
            </select>
            <span className="label-tip">
              {intl.formatMessage(messages.movieHelp)}
            </span>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="tv-maturity-limit">
            {intl.formatMessage(messages.tvLabel)}
          </label>
          <div className="form-input-area">
            <select
              id="tv-maturity-limit"
              value={tvLimit}
              onChange={(event) => {
                setTvLimit(event.target.value);
                setSaved(false);
              }}
              disabled={saving}
            >
              <option value="">{intl.formatMessage(messages.tvNone)}</option>
              {TV_MATURITY_LIMITS.map((rating) => {
                const label = {
                  'TV-Y': messages.tvY,
                  'TV-Y7': messages.tvY7,
                  'TV-G': messages.tvG,
                  'TV-PG': messages.tvPg,
                  'TV-14': messages.tv14,
                  'TV-MA': messages.tvMa,
                }[rating];
                return (
                  <option key={rating} value={rating}>
                    {intl.formatMessage(label)}
                  </option>
                );
              })}
            </select>
            <span className="label-tip">
              {intl.formatMessage(messages.tvHelp)}
            </span>
          </div>
        </div>

        <div className="actions">
          <div className="settings-page-actions">
            <Button buttonType="primary" type="submit" disabled={saving}>
              {intl.formatMessage(saving ? messages.saving : messages.save)}
            </Button>
          </div>
        </div>
        {saved && (
          <p className="description" role="status">
            {intl.formatMessage(messages.saved)}
          </p>
        )}
        {saveFailed && (
          <p className="error" role="alert">
            {intl.formatMessage(messages.saveFailure)}
          </p>
        )}
      </form>
    </section>
  );
};

export default UserMaturityControls;
