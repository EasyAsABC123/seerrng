import Alert from '@app/components/Common/Alert';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.AppDataWarning', {
  dockerVolumeMissingDescription:
    'The <code>{appDataPath}</code> volume mount was not configured properly. All data will be cleared when the container is stopped or restarted.',
  misplacedConfigMountDescription:
    'Files were found at <code>{misplacedPath}</code>. SeerrNG stores its data at <code>{appDataPath}</code>, so map your host appdata folder to <code>{appDataPath}</code> instead.',
  appDataNotWritableDescription:
    'SeerrNG cannot write to <code>{appDataPath}</code>. The container runs as UID 1000 and GID 1000, so set the host folder ownership to match (for example <code>chown -R 1000:1000</code> on the appdata folder).',
});

interface AppDataStatus {
  appData: boolean;
  appDataPath: string;
  appDataWritable?: boolean;
  misplacedConfigMount?: string | null;
}

const code = (msg: React.ReactNode) => (
  <code className="bg-gray-800/50">{msg}</code>
);

const AppDataWarning = () => {
  const intl = useIntl();
  const { data } = useSWR<AppDataStatus>('/api/v1/status/appdata');

  if (!data) {
    return null;
  }

  return (
    <>
      {!data.appData && (
        <Alert
          title={intl.formatMessage(messages.dockerVolumeMissingDescription, {
            code,
            appDataPath: data.appDataPath,
          })}
        >
          {data.misplacedConfigMount &&
            intl.formatMessage(messages.misplacedConfigMountDescription, {
              code,
              appDataPath: data.appDataPath,
              misplacedPath: data.misplacedConfigMount,
            })}
        </Alert>
      )}
      {data.appDataWritable === false && (
        <Alert
          title={intl.formatMessage(messages.appDataNotWritableDescription, {
            code,
            appDataPath: data.appDataPath,
          })}
        />
      )}
    </>
  );
};

export default AppDataWarning;
