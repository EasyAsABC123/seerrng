import Alert from '@app/components/Common/Alert';
import Button from '@app/components/Common/Button';
import Header from '@app/components/Common/Header';
import MediaTypeBadge from '@app/components/Common/MediaTypeBadge';
import PageTitle from '@app/components/Common/PageTitle';
import RequestModal from '@app/components/RequestModal';
import { Permission, useUser } from '@app/hooks/useUser';
import { encodeApiPathSegment } from '@app/utils/apiPath';
import defineMessages from '@app/utils/defineMessages';
import { MediaStatus } from '@server/constants/media';
import type { AdultDetails as AdultDetailsModel } from '@server/models/Adult';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.AdultDetails', {
  notFound: 'This scene could not be found in Whisparr.',
  unavailable: 'Adult scene details are unavailable right now.',
  request: 'Request scene',
  activeRequest: 'Manage your request',
  available: 'This scene is already available.',
  processing: 'This scene is already being processed.',
  noPermission: 'You do not have permission to request adult media.',
  studio: 'Studio',
});

const AdultDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const { hasPermission } = useUser();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const sceneId =
    typeof router.query.sceneId === 'string' ? router.query.sceneId : '';
  const { data, error, mutate } = useSWR<AdultDetailsModel>(
    sceneId ? `/api/v1/adult/${encodeApiPathSegment(sceneId)}` : null
  );
  const canRequest = hasPermission(
    [Permission.ADMIN, Permission.REQUEST_ADULT],
    { type: 'or' }
  );
  const canManage = hasPermission(Permission.MANAGE_REQUESTS);
  const activeRequestId = data?.mediaInfo?.requestId;
  const isAvailable =
    data?.mediaInfo?.status === MediaStatus.AVAILABLE ||
    data?.mediaInfo?.status === MediaStatus.PARTIALLY_AVAILABLE;
  const isProcessing = data?.mediaInfo?.status === MediaStatus.PROCESSING;

  if (error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    return (
      <Alert
        title={intl.formatMessage(
          status === 404 ? messages.notFound : messages.unavailable
        )}
        type="warning"
      />
    );
  }

  if (!data) return null;

  return (
    <>
      <PageTitle title={data.title} />
      <div className="app-page-detail space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <MediaTypeBadge mediaType="adult" variant="compact" />
          <Header>{data.title}</Header>
          {data.year && <span className="text-gray-300">{data.year}</span>}
        </div>
        <div className="max-w-3xl space-y-3">
          {data.studio && (
            <p className="text-sm text-gray-300">
              <strong className="text-white">
                {intl.formatMessage(messages.studio)}:
              </strong>{' '}
              {data.studio}
            </p>
          )}
          {data.overview && (
            <p className="whitespace-pre-line text-gray-200">{data.overview}</p>
          )}
        </div>
        {(isAvailable || (isProcessing && !activeRequestId)) && (
          <Alert type="info">
            {intl.formatMessage(
              isAvailable ? messages.available : messages.processing
            )}
          </Alert>
        )}
        {canRequest || (activeRequestId && canManage) ? (
          <Button
            buttonType="primary"
            onClick={() => setShowRequestModal(true)}
          >
            {intl.formatMessage(
              activeRequestId ? messages.activeRequest : messages.request
            )}
          </Button>
        ) : (
          <Alert type="info">{intl.formatMessage(messages.noPermission)}</Alert>
        )}
        {showRequestModal && (
          <RequestModal
            type="adult"
            adultId={data.id}
            adultRequestId={activeRequestId}
            show
            onCancel={() => setShowRequestModal(false)}
            onComplete={() => {
              setShowRequestModal(false);
              void mutate();
            }}
          />
        )}
      </div>
    </>
  );
};

export default AdultDetails;
