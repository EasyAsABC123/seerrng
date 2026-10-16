import Alert from '@app/components/Common/Alert';
import Modal from '@app/components/Common/Modal';
import QuotaDisplay from '@app/components/RequestModal/QuotaDisplay';
import useSettings from '@app/hooks/useSettings';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import { encodeApiPathSegment } from '@app/utils/apiPath';
import defineMessages from '@app/utils/defineMessages';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import type { QuotaResponse } from '@server/interfaces/api/userInterfaces';
import type { AdultDetails } from '@server/models/Adult';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate, useSWRConfig } from 'swr';

const messages = defineMessages('components.RequestModal.Adult', {
  request: 'Request scene',
  cancelRequest: 'Cancel request',
  success: '<strong>{title}</strong> requested successfully.',
  cancelled: 'Request for <strong>{title}</strong> canceled.',
  submitError: 'Something went wrong while submitting the request.',
  cancelError: 'Something went wrong while canceling the request.',
  backendError:
    'Whisparr could not accept this scene request. Check the service and try again.',
  permission: 'You do not have permission to request adult media.',
  categoryDisabled: 'Adult requests are disabled by the administrator.',
  pending: 'Your adult scene request is waiting for approval.',
  requestFor: "{username}'s request is waiting for approval.",
  studio: 'Studio: {studio}',
  year: 'Year: {year}',
});

interface AdultRequestModalProps {
  adultId: string;
  adultRequestId?: number;
  onCancel?: () => void;
  onComplete?: (newStatus: MediaStatus) => void;
  onUpdating?: (isUpdating: boolean) => void;
  editRequest?: NonFunctionProperties<MediaRequest>;
}

const AdultRequestModal = ({
  adultId,
  adultRequestId,
  onCancel,
  onComplete,
  onUpdating,
  editRequest,
}: AdultRequestModalProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { user, hasPermission } = useUser();
  const { currentSettings } = useSettings();
  const { mutate: mutateCache } = useSWRConfig();
  const [isUpdating, setIsUpdating] = useState(false);
  const detailUrl = `/api/v1/adult/${encodeApiPathSegment(adultId)}`;
  const { data } = useSWR<AdultDetails>(detailUrl);
  const { data: quota } = useSWR<QuotaResponse>(
    user ? `/api/v1/user/${user.id}/quota` : null
  );
  const requestId = editRequest?.id ?? adultRequestId;
  const isEditing = requestId !== undefined;
  const canRequest = hasPermission(
    [Permission.ADMIN, Permission.REQUEST_ADULT],
    { type: 'or' }
  );
  const categoryEnabled =
    currentSettings.adultEnabled &&
    currentSettings.enabledMediaCategories?.adult !== false;
  const isQuotaRestricted = quota?.adult?.restricted ?? false;

  useEffect(() => onUpdating?.(isUpdating), [isUpdating, onUpdating]);

  const refreshRequests = useCallback(async () => {
    await Promise.all([
      mutate(detailUrl),
      mutate('/api/v1/request/count'),
      mutate('/api/v1/request?filter=all&take=10&sort=modified&skip=0'),
      mutateCache(
        (key) =>
          typeof key === 'string' && key.startsWith('/api/v1/request/status')
      ),
    ]);
  }, [detailUrl, mutateCache]);

  const sendRequest = useCallback(async () => {
    if (!data || !canRequest || !categoryEnabled || isQuotaRestricted) {
      return;
    }
    setIsUpdating(true);
    try {
      const response = await axios.post<MediaRequest>('/api/v1/request', {
        mediaId: adultId,
        mediaType: 'adult',
      });
      await refreshRequests();
      if (response.data?.status === MediaRequestStatus.FAILED) {
        addToast(intl.formatMessage(messages.backendError), {
          appearance: 'error',
          autoDismiss: true,
        });
        return;
      }
      onComplete?.(
        response.data.status === MediaRequestStatus.APPROVED
          ? MediaStatus.PROCESSING
          : MediaStatus.PENDING
      );
      addToast(
        <span>
          {intl.formatMessage(messages.success, {
            title: data.title,
            strong: (text: React.ReactNode) => <strong>{text}</strong>,
          })}
        </span>,
        { appearance: 'success', autoDismiss: true }
      );
    } catch (error) {
      const responseMessage = axios.isAxiosError<{ message?: unknown }>(error)
        ? error.response?.data?.message
        : undefined;
      addToast(
        typeof responseMessage === 'string' && responseMessage
          ? responseMessage
          : intl.formatMessage(messages.submitError),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setIsUpdating(false);
    }
  }, [
    addToast,
    adultId,
    canRequest,
    categoryEnabled,
    data,
    intl,
    isQuotaRestricted,
    onComplete,
    refreshRequests,
  ]);

  const cancelRequest = async () => {
    if (!requestId) return;
    setIsUpdating(true);
    try {
      const response = await axios.delete(`/api/v1/request/${requestId}`);
      await refreshRequests();
      if (response.status === 204) {
        onComplete?.(MediaStatus.UNKNOWN);
        addToast(
          <span>
            {intl.formatMessage(messages.cancelled, {
              title: data?.title ?? adultId,
              strong: (text: React.ReactNode) => <strong>{text}</strong>,
            })}
          </span>,
          { appearance: 'success', autoDismiss: true }
        );
      }
    } catch {
      addToast(intl.formatMessage(messages.cancelError), {
        appearance: 'error',
        autoDismiss: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (editRequest) {
    const isOwner = editRequest.requestedBy.id === user?.id;
    return (
      <Modal
        backgroundClickable
        onCancel={onCancel}
        title={intl.formatMessage(messages.cancelRequest)}
        subTitle={data?.title ?? adultId}
        onOk={() => void cancelRequest()}
        okDisabled={isUpdating}
        okText={intl.formatMessage(messages.cancelRequest)}
        okButtonType="danger"
        cancelText={intl.formatMessage(globalMessages.close)}
        cancelButtonType="default"
      >
        <div className="app-card-inset refreshed-inset-surface rounded-lg border border-gray-700 p-3">
          {isOwner
            ? intl.formatMessage(messages.pending)
            : intl.formatMessage(messages.requestFor, {
                username: editRequest.requestedBy.displayName,
              })}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      loading={!data || !quota}
      backgroundClickable
      onCancel={onCancel}
      title={intl.formatMessage(
        isEditing ? messages.cancelRequest : messages.request
      )}
      subTitle={data?.title ?? adultId}
      onOk={() => (isEditing ? void cancelRequest() : void sendRequest())}
      okDisabled={
        isUpdating ||
        (!isEditing && (!canRequest || !categoryEnabled || isQuotaRestricted))
      }
      okText={intl.formatMessage(
        isEditing ? messages.cancelRequest : messages.request
      )}
      okButtonType={isEditing ? 'danger' : 'primary'}
      cancelText={intl.formatMessage(globalMessages.close)}
    >
      {data?.studio && (
        <p className="mb-2 text-sm text-gray-300">
          {intl.formatMessage(messages.studio, { studio: data.studio })}
        </p>
      )}
      {data?.year && (
        <p className="mb-2 text-sm text-gray-300">
          {intl.formatMessage(messages.year, { year: data.year })}
        </p>
      )}
      {isEditing ? (
        <Alert type="info">{intl.formatMessage(messages.pending)}</Alert>
      ) : !canRequest ? (
        <Alert type="warning">{intl.formatMessage(messages.permission)}</Alert>
      ) : !categoryEnabled ? (
        <Alert type="warning">
          {intl.formatMessage(messages.categoryDisabled)}
        </Alert>
      ) : (
        quota?.adult?.limit !== undefined &&
        quota.adult.limit > 0 && (
          <QuotaDisplay mediaType="adult" quota={quota.adult} />
        )
      )}
    </Modal>
  );
};

export default AdultRequestModal;
