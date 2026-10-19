import UserSettings from '@app/components/UserProfile/UserSettings';
import UserEpisodeQueueSettings from '@app/components/UserProfile/UserSettings/UserEpisodeQueueSettings';
import type { NextPage } from 'next';

const UserEpisodeQueueSettingsPage: NextPage = () => (
  <UserSettings>
    <UserEpisodeQueueSettings />
  </UserSettings>
);

export default UserEpisodeQueueSettingsPage;
