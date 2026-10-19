import UserSettings from '@app/components/UserProfile/UserSettings';
import UserTvSeasonWatchGateAccess from '@app/components/UserProfile/UserSettings/UserTvSeasonWatchGateAccess';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const TvRequestAccessPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserTvSeasonWatchGateAccess />
    </UserSettings>
  );
};

export default TvRequestAccessPage;
