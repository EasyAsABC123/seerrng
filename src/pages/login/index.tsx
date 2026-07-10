import Login from '@app/components/Login';
import { getInternalApiBaseUrl } from '@app/utils/internalApi';
import axios from 'axios';
import type { GetServerSideProps, NextPage } from 'next';

type LoginPageProps = {
  initialBackdrops?: string[];
};

const LoginPage: NextPage<LoginPageProps> = ({ initialBackdrops }) => {
  return <Login initialBackdrops={initialBackdrops} />;
};

export const getServerSideProps: GetServerSideProps<
  LoginPageProps
> = async () => {
  try {
    const response = await axios.get<string[]>(
      `${getInternalApiBaseUrl()}/api/v1/backdrops`
    );

    return { props: { initialBackdrops: response.data } };
  } catch {
    return { props: {} };
  }
};

export default LoginPage;
