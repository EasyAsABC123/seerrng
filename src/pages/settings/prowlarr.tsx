import SettingsLayout from '@app/components/Settings/SettingsLayout';
import SettingsProwlarr from '@app/components/Settings/SettingsProwlarr';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const ProwlarrSettingsPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsProwlarr />
    </SettingsLayout>
  );
};

export default ProwlarrSettingsPage;
