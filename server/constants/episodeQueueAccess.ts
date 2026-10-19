export const EPISODE_QUEUE_ACCESS_STATUS = {
  OFF: 'off',
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;

export const EPISODE_QUEUE_ACCESS_STATUSES = Object.values(
  EPISODE_QUEUE_ACCESS_STATUS
);

export type EpisodeQueueAccessStatus =
  (typeof EPISODE_QUEUE_ACCESS_STATUSES)[number];
