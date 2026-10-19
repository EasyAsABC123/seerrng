import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import useToasts from '@app/hooks/useToasts';
import { getPositiveQueryParamNumber } from '@app/hooks/useUpdateQueryParams';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { EpisodeQueueAccessResponse } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages(
  'components.UserProfile.UserSettings.UserEpisodeQueueSettings',
  {
    title: 'Episode Queue',
    description:
      'Keep upcoming episodes requested as you watch. Set a default once for all of your shows, then change an individual show from its request when needed.',
    statusOff: 'Access not requested',
    statusPending: 'Waiting for approval',
    statusApproved: 'Access approved',
    statusDenied: 'Request declined',
    statusDescriptionOff:
      'A user manager must approve Episode Queue before you can turn it on for your shows.',
    statusDescriptionPending:
      'Your request is in the user manager’s review queue. You can cancel it while it is pending.',
    statusDescriptionApproved:
      'Your default applies to existing and future TV requests. Requests with a show-specific override keep that choice.',
    statusDescriptionDenied:
      'A user manager declined this request. You can request access again from this page.',
    request: 'Request access',
    requestAgain: 'Request again',
    cancel: 'Cancel request',
    approve: 'Approve access',
    deny: 'Decline request',
    revoke: 'Revoke access',
    defaultLabel: 'Default episodes to queue',
    defaultHelp:
      'This applies to all of {userName}’s TV requests. Set Off to pause the default; show-specific choices stay in place.',
    off: 'Off',
    episodeOption: '{count, plural, one {# episode} other {# episodes}}',
    save: 'Save default',
    saving: 'Saving…',
    saved: 'Episode Queue settings saved.',
    error: 'Could not update Episode Queue settings. Try again.',
    loadError: 'Could not load Episode Queue settings.',
    noPermission: 'Only this user or a user manager can manage these settings.',
    modalRequestTitle: 'Request Episode Queue access?',
    modalRequestDescription:
      'A user manager will review your request. Once approved, you can choose a default that applies to all your shows.',
    modalCancelTitle: 'Cancel your request?',
    modalCancelDescription:
      'Your request will be removed from the review queue. You can request access again later.',
    modalApproveTitle: 'Approve Episode Queue access?',
    modalApproveDescription:
      'This user will be able to set a default Episode Queue length for all of their shows and override individual requests.',
    modalDenyTitle: 'Decline this request?',
    modalDenyDescription:
      'The user can request Episode Queue access again from their profile.',
    modalRevokeTitle: 'Revoke Episode Queue access?',
    modalRevokeDescription:
      'This stops future Episode Queue additions for the user. Episodes already requested remain in place.',
    dateRequested: 'Requested {date}',
  }
);

type EpisodeQueueAction = 'request' | 'cancel' | 'approve' | 'deny' | 'revoke';

const UserEpisodeQueueSettings = () => {
  const router = useRouter();
  const intl = useIntl();
  const { addToast } = useToasts();
  const { user: currentUser, hasPermission } = useUser();
  const profileUserId = getPositiveQueryParamNumber(router.query.userId);
  const targetUserId = profileUserId ?? currentUser?.id;
  const isSelf = targetUserId === currentUser?.id;
  const canManageUsers = hasPermission(Permission.MANAGE_USERS);
  const canReview = canManageUsers && !isSelf;
  const {
    data,
    error: loadError,
    mutate: refreshAccess,
  } = useSWR<EpisodeQueueAccessResponse>(
    targetUserId ? `/api/v1/user/${targetUserId}/settings/episode-queue` : null
  );
  const [defaultCount, setDefaultCount] = useState(0);
  const [pendingAction, setPendingAction] = useState<EpisodeQueueAction>();
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState(false);

  useEffect(() => {
    setDefaultCount(data?.defaultEpisodeCount ?? 0);
  }, [data?.defaultEpisodeCount]);

  const status = data?.status ?? 'off';
  const statusLabel =
    status === 'pending'
      ? messages.statusPending
      : status === 'approved'
        ? messages.statusApproved
        : status === 'denied'
          ? messages.statusDenied
          : messages.statusOff;
  const statusDescription =
    status === 'pending'
      ? messages.statusDescriptionPending
      : status === 'approved'
        ? messages.statusDescriptionApproved
        : status === 'denied'
          ? messages.statusDescriptionDenied
          : messages.statusDescriptionOff;
  const displayName = isSelf ? 'your account' : 'this user';

  const submitAction = async () => {
    if (!pendingAction || !targetUserId) return;
    setIsSaving(true);
    setActionError(false);
    try {
      let response: { data: EpisodeQueueAccessResponse };
      if (pendingAction === 'approve' || pendingAction === 'deny') {
        response = await axios.post<EpisodeQueueAccessResponse>(
          `/api/v1/user/${targetUserId}/settings/episode-queue/review`,
          { decision: pendingAction }
        );
      } else if (pendingAction === 'revoke') {
        response = await axios.post<EpisodeQueueAccessResponse>(
          `/api/v1/user/${targetUserId}/settings/episode-queue/review`,
          { decision: 'revoke' }
        );
      } else {
        response = await axios.post<EpisodeQueueAccessResponse>(
          `/api/v1/user/${targetUserId}/settings/episode-queue`,
          { action: pendingAction }
        );
      }
      setPendingAction(undefined);
      await refreshAccess(response.data);
      await mutate(`/api/v1/user/${targetUserId}`);
      await mutate('/api/v1/auth/me');
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      setActionError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const saveDefault = async () => {
    if (!targetUserId) return;
    setIsSaving(true);
    setActionError(false);
    try {
      const { data: nextAccess } = await axios.post<EpisodeQueueAccessResponse>(
        `/api/v1/user/${targetUserId}/settings/episode-queue`,
        { action: 'set-default', defaultEpisodeCount: defaultCount }
      );
      await refreshAccess(nextAccess);
      await mutate(`/api/v1/user/${targetUserId}`);
      await mutate('/api/v1/auth/me');
      addToast(intl.formatMessage(messages.saved), {
        appearance: 'success',
        autoDismiss: true,
      });
    } catch {
      setActionError(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (!targetUserId || (!isSelf && !canManageUsers)) {
    return (
      <Alert type="error" title={intl.formatMessage(messages.noPermission)} />
    );
  }
  if (!data && !loadError) return <LoadingSpinner />;
  if (!data) {
    return (
      <Alert type="error" title={intl.formatMessage(messages.loadError)} />
    );
  }

  const statusBadge =
    status === 'approved'
      ? 'success'
      : status === 'pending'
        ? 'warning'
        : status === 'denied'
          ? 'danger'
          : 'default';
  const actionMessage =
    pendingAction === 'request'
      ? messages.modalRequestDescription
      : pendingAction === 'cancel'
        ? messages.modalCancelDescription
        : pendingAction === 'approve'
          ? messages.modalApproveDescription
          : pendingAction === 'revoke'
            ? messages.modalRevokeDescription
            : messages.modalDenyDescription;
  const actionTitle =
    pendingAction === 'request'
      ? messages.modalRequestTitle
      : pendingAction === 'cancel'
        ? messages.modalCancelTitle
        : pendingAction === 'approve'
          ? messages.modalApproveTitle
          : pendingAction === 'revoke'
            ? messages.modalRevokeTitle
            : messages.modalDenyTitle;

  return (
    <div className="space-y-5">
      {pendingAction && (
        <Modal
          title={intl.formatMessage(actionTitle)}
          onCancel={() => setPendingAction(undefined)}
          onOk={() => void submitAction()}
          okText={intl.formatMessage(
            isSaving
              ? messages.saving
              : pendingAction === 'request'
                ? messages.request
                : pendingAction === 'cancel'
                  ? messages.cancel
                  : pendingAction === 'approve'
                    ? messages.approve
                    : pendingAction === 'revoke'
                      ? messages.revoke
                      : messages.deny
          )}
          okDisabled={isSaving}
          okButtonType={
            pendingAction === 'deny' || pendingAction === 'revoke'
              ? 'danger'
              : 'primary'
          }
        >
          {intl.formatMessage(actionMessage)}
        </Modal>
      )}
      <section className="app-card-main refreshed-card-surface rounded-xl border border-gray-700 p-5 shadow-lg shadow-gray-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="text-lg font-semibold text-white">
              {intl.formatMessage(messages.title)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {intl.formatMessage(messages.description)}
            </p>
          </div>
          <Badge badgeType={statusBadge}>
            {intl.formatMessage(statusLabel)}
          </Badge>
        </div>

        <div className="refreshed-inset-surface mt-5 rounded-lg border border-gray-700 p-4">
          <p className="text-sm leading-6 text-gray-300">
            {intl.formatMessage(statusDescription)}
          </p>
          {data.requestedAt && status === 'pending' && (
            <p className="refreshed-detail-text-muted mt-2 text-xs">
              {intl.formatMessage(messages.dateRequested, {
                date: intl.formatDate(new Date(data.requestedAt), {
                  dateStyle: 'medium',
                }),
              })}
            </p>
          )}
        </div>

        {status === 'approved' && (
          <div className="refreshed-inset-surface mt-5 rounded-lg border border-gray-700 p-4">
            <label
              htmlFor="episode-queue-default-count"
              className="block text-sm font-semibold text-white"
            >
              {intl.formatMessage(messages.defaultLabel)}
            </label>
            <select
              id="episode-queue-default-count"
              className="request-form-control mt-2 w-full max-w-md rounded-md border px-3 py-2 text-sm"
              value={defaultCount}
              onChange={(event) => setDefaultCount(Number(event.target.value))}
              disabled={isSaving}
            >
              <option value={0}>{intl.formatMessage(messages.off)}</option>
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count} value={count}>
                  {intl.formatMessage(messages.episodeOption, { count })}
                </option>
              ))}
            </select>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
              {intl.formatMessage(messages.defaultHelp, {
                userName: displayName,
              })}
            </p>
            <Button
              className="mt-4"
              buttonType="primary"
              disabled={isSaving || defaultCount === data.defaultEpisodeCount}
              onClick={() => void saveDefault()}
            >
              {intl.formatMessage(isSaving ? messages.saving : messages.save)}
            </Button>
          </div>
        )}

        {(actionError || loadError) && (
          <div className="mt-4">
            <Alert type="error" title={intl.formatMessage(messages.error)} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {isSelf && (status === 'off' || status === 'denied') && (
            <Button
              buttonType="primary"
              onClick={() => setPendingAction('request')}
            >
              {intl.formatMessage(
                status === 'denied' ? messages.requestAgain : messages.request
              )}
            </Button>
          )}
          {isSelf && status === 'pending' && (
            <Button
              buttonType="ghost"
              onClick={() => setPendingAction('cancel')}
            >
              {intl.formatMessage(messages.cancel)}
            </Button>
          )}
          {canReview && status === 'pending' && (
            <>
              <Button
                buttonType="primary"
                onClick={() => setPendingAction('approve')}
              >
                {intl.formatMessage(messages.approve)}
              </Button>
              <Button
                buttonType="danger"
                onClick={() => setPendingAction('deny')}
              >
                {intl.formatMessage(messages.deny)}
              </Button>
            </>
          )}
          {canReview && status === 'approved' && (
            <Button
              buttonType="danger"
              onClick={() => setPendingAction('revoke')}
            >
              {intl.formatMessage(messages.revoke)}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
};

export default UserEpisodeQueueSettings;
