import Alert from '@app/components/Common/Alert';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import Modal from '@app/components/Common/Modal';
import { useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import type { EpisodeQueueApprovalRequest } from '@server/interfaces/api/userSettingsInterfaces';
import axios from 'axios';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages(
  'components.UserList.EpisodeQueueApprovalQueue',
  {
    title: 'Episode Queue access requests',
    description:
      'Review users who want a saved Episode Queue default for all of their TV requests.',
    empty: 'No pending Episode Queue requests.',
    approve: 'Approve',
    deny: 'Decline',
    approveTitle: 'Approve Episode Queue access?',
    denyTitle: 'Decline Episode Queue access?',
    approveDescription:
      'This user can set a default queue length that applies across their shows.',
    denyDescription:
      'This user can request Episode Queue access again from their profile.',
    viewProfile: 'Open profile settings',
    requested: 'Requested {date}',
    error: 'Could not review this request. Refresh and try again.',
    loading: 'Saving…',
    ownRequest: 'Another user manager must review your request.',
  }
);

type ReviewDecision = 'approve' | 'deny';

const EpisodeQueueApprovalQueue = () => {
  const intl = useIntl();
  const { user: currentUser } = useUser();
  const [selectedRequest, setSelectedRequest] = useState<{
    request: EpisodeQueueApprovalRequest;
    decision: ReviewDecision;
  }>();
  const [reviewError, setReviewError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, mutate } = useSWR<EpisodeQueueApprovalRequest[]>(
    '/api/v1/user/episode-queue-requests',
    { refreshInterval: 60_000 }
  );

  const reviewRequest = async () => {
    if (!selectedRequest) return;
    setIsSaving(true);
    setReviewError(false);
    try {
      await axios.post(
        `/api/v1/user/${selectedRequest.request.id}/settings/episode-queue/review`,
        { decision: selectedRequest.decision }
      );
      setSelectedRequest(undefined);
      await mutate();
    } catch {
      setReviewError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {selectedRequest && (
        <Modal
          title={intl.formatMessage(
            selectedRequest.decision === 'approve'
              ? messages.approveTitle
              : messages.denyTitle
          )}
          subTitle={selectedRequest.request.displayName}
          onCancel={() => setSelectedRequest(undefined)}
          onOk={() => void reviewRequest()}
          okText={
            isSaving
              ? intl.formatMessage(messages.loading)
              : intl.formatMessage(
                  selectedRequest.decision === 'approve'
                    ? messages.approve
                    : messages.deny
                )
          }
          okDisabled={isSaving}
          okButtonType={
            selectedRequest.decision === 'approve' ? 'primary' : 'danger'
          }
        >
          {intl.formatMessage(
            selectedRequest.decision === 'approve'
              ? messages.approveDescription
              : messages.denyDescription
          )}
        </Modal>
      )}
      <section className="app-card-main refreshed-card-surface mt-5 rounded-xl border border-gray-700 p-4 shadow-lg shadow-gray-950/20">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {intl.formatMessage(messages.title)}
            </h3>
            <p className="refreshed-detail-text-muted mt-1 text-sm">
              {intl.formatMessage(messages.description)}
            </p>
          </div>
          {data && (
            <Badge badgeType={data.length ? 'warning' : 'default'}>
              {data.length}
            </Badge>
          )}
        </div>
        {error && (
          <Alert type="error" title={intl.formatMessage(messages.error)} />
        )}
        {reviewError && (
          <Alert type="error" title={intl.formatMessage(messages.error)} />
        )}
        {!data && !error ? (
          <LoadingSpinner />
        ) : data?.length ? (
          <ul className="divide-y divide-gray-700">
            {data.map((request) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                key={request.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CachedImage
                    type="avatar"
                    className="h-10 w-10 rounded-full object-cover"
                    src={request.avatar}
                    alt=""
                    width={40}
                    height={40}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {request.displayName}
                    </div>
                    {request.requestedAt && (
                      <div className="refreshed-detail-text-muted text-xs">
                        {intl.formatMessage(messages.requested, {
                          date: intl.formatDate(new Date(request.requestedAt), {
                            dateStyle: 'medium',
                          }),
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    as="a"
                    href={`/users/${request.id}/settings/episode-queue`}
                    buttonType="ghost"
                    buttonSize="sm"
                  >
                    {intl.formatMessage(messages.viewProfile)}
                  </Button>
                  {currentUser?.id === request.id ? (
                    <span className="refreshed-detail-text-muted text-xs">
                      {intl.formatMessage(messages.ownRequest)}
                    </span>
                  ) : (
                    <>
                      <Button
                        buttonType="primary"
                        buttonSize="sm"
                        onClick={() =>
                          setSelectedRequest({ request, decision: 'approve' })
                        }
                      >
                        {intl.formatMessage(messages.approve)}
                      </Button>
                      <Button
                        buttonType="danger"
                        buttonSize="sm"
                        onClick={() =>
                          setSelectedRequest({ request, decision: 'deny' })
                        }
                      >
                        {intl.formatMessage(messages.deny)}
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="refreshed-detail-text-muted text-sm">
            {intl.formatMessage(messages.empty)}
          </p>
        )}
      </section>
    </>
  );
};

export default EpisodeQueueApprovalQueue;
