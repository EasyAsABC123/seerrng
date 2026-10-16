import UserSettings from '@app/components/UserProfile/UserSettings';
import UserMaturityControls from '@app/components/UserProfile/UserSettings/UserMaturityControls';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const UserMaturityControlsPage: NextPage = () => {
  useRouteGuard(Permission.MANAGE_USERS);
  return (
    <UserSettings>
      <UserMaturityControls />
    </UserSettings>
  );
};

export default UserMaturityControlsPage;
