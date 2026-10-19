import useSWR from 'swr';

/** Unread personal-news count beside the Following link. */
const FollowUnreadCount = () => {
  const { data } = useSWR<{ unseen: number }>('/api/v1/follow/events/count', {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });
  if (!data?.unseen) return null;
  return (
    <span className="follow-unread-count" aria-label={`${data.unseen}`}>
      {data.unseen > 99 ? '99+' : data.unseen}
    </span>
  );
};

export default FollowUnreadCount;
