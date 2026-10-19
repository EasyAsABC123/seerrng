export const TV_SEASON_WATCH_GATE_STATUS = {
  OFF: 'off',
  PENDING: 'pending',
  APPROVED: 'approved',
  ENABLED: 'enabled',
  DENIED: 'denied',
} as const;

export const TV_SEASON_WATCH_GATE_STATUSES = Object.values(
  TV_SEASON_WATCH_GATE_STATUS
);

export type TvSeasonWatchGateStatus =
  (typeof TV_SEASON_WATCH_GATE_STATUSES)[number];
