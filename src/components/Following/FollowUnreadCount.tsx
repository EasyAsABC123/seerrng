import { useIntl } from 'react-intl';
import useSWR from 'swr';

/** Unread personal-news count beside the Following link. */
const FollowUnreadCount = () => {
  const intl = useIntl();
  const { data } = useSWR<{ unseen: number }>('/api/v1/follow/events/count', {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });
  if (!data?.unseen) return null;
  return (
    <span
      className="follow-unread-count"
      aria-label={intl.formatMessage(
        {
          id: 'components.Following.unreadCount',
          defaultMessage:
            '{count, plural, one {# unread update} other {# unread updates}}',
        },
        { count: data.unseen }
      )}
    >
      {data.unseen > 99 ? '99+' : data.unseen}
    </span>
  );
};

export default FollowUnreadCount;
