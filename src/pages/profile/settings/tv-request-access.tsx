import UserSettings from '@app/components/UserProfile/UserSettings';
import UserTvSeasonWatchGateAccess from '@app/components/UserProfile/UserSettings/UserTvSeasonWatchGateAccess';
import type { NextPage } from 'next';

const TvRequestAccessPage: NextPage = () => (
  <UserSettings>
    <UserTvSeasonWatchGateAccess />
  </UserSettings>
);

export default TvRequestAccessPage;
