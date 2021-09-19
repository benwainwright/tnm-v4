import { Auth } from '@aws-amplify/auth';
import { getPoolConfig, AuthDetails } from './getPoolConfig';

const REGION = 'eu-west-2';

const getConfigurer = () => {
  // eslint-disable-next-line fp/no-let
  let outputs: undefined | AuthDetails;
  return async () => {
    if (!outputs) {
      outputs = await getPoolConfig();
      Auth.configure({
        Auth: {
          region: REGION,
          userPoolId: outputs.UserPoolId,
          userPoolWebClientId: outputs.ClientId,
          cookieStorage: {
            domain: process.env.NEXT_PUBLIC_IS_LOCAL_DEV
              ? 'localhost'
              : outputs.DomainName,
            secure: !Boolean(process.env.NEXT_PUBLIC_IS_LOCAL_DEV),
            path: '/',
            expires: 365,
          },
        },
      });
    }
    return outputs;
  };
};

const configureAuth = getConfigurer();

export const login = async (username: string, password: string) => {
  await configureAuth();
  return Auth.signIn(username, password);
};

export const register = async (
  username: string,
  password: string,
  _salutation: string,
  email: string,
  _firstname: string,
  _surname: string,
  _address: string,
  telephone: string,
) => {
  await configureAuth();
  return Auth.signUp({
    username,
    password,
    attributes: {
      // "custom:salutation": salutation,
      email: email,
      // given_name: firstname,
      // family_name: surname,
      // address: address,
      phone_number: telephone,
    },
  });
};

export const signOut = async () => {
  await configureAuth();
  return Auth.signOut();
};

export const confirmSignup = async (username: string, code: string) => {
  await configureAuth();
  return Auth.confirmSignUp(username, code);
};

export const currentUser = async () => {
  await configureAuth();
  try {
    return await Auth.currentAuthenticatedUser();
  } catch {
    return undefined;
  }
};

export const newPasswordChallengeResponse = async (
  user: any,
  password: string,
) => {
  await configureAuth();
  return Auth.completeNewPassword(user, password);
};
