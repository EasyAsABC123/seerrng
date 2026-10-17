import { Permission } from '@app/hooks/useUser';

interface RestrictableUser {
  contentRestricted?: boolean | null;
  permissions?: number;
}

/** Mirrors the server policy; the server enforces it regardless. */
export const isContentRestrictedUser = (
  user: RestrictableUser | undefined,
  defaultRestricted: boolean | undefined
): boolean => {
  if (!user) {
    return false;
  }
  if (typeof user.contentRestricted === 'boolean') {
    return user.contentRestricted;
  }
  const isAdmin = ((user.permissions ?? 0) & Permission.ADMIN) !== 0;
  return !isAdmin && defaultRestricted === true;
};
