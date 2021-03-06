import { GetServerSideProps } from 'next';
import { verifyJwtToken } from './authentication';
import { backendRedirect } from './backend-redirect';

interface AuthorizedRouteWrapper {
  (args?: {
    groups?: string[];
    getServerSideProps?: GetServerSideProps;
  }): GetServerSideProps;
}

export const authorizedRoute: AuthorizedRouteWrapper = ({
  groups,
  getServerSideProps,
} = {}): GetServerSideProps => {
  return async (context) => {
    const tokenPair = Object.entries(context.req.cookies).find(([key]) =>
      key.endsWith('.accessToken'),
    );

    if (!tokenPair || tokenPair.length !== 2) {
      return backendRedirect('login', 'No .accessToken found');
    }

    const verifyResult = await verifyJwtToken(tokenPair[1]);

    if (!verifyResult.isValid) {
      return backendRedirect('login', 'Token verification failed');
    }

    if (groups?.some((group) => !verifyResult.groups.includes(group))) {
      return backendRedirect(
        'login',
        'Verification was successful, but user is not authorised to access this route',
      );
    }

    return (await getServerSideProps?.(context)) ?? { props: {} };
  };
};
