import { UserPool, VerificationEmailStyle } from '@aws-cdk/aws-cognito';
import { CfnOutput, RemovalPolicy, Construct } from '@aws-cdk/core';
import { getResourceName } from './get-resource-name';

export const makeUserPool = (
  context: Construct,
  transient: boolean,
  environmentName: string,
) => {
  const removalPolicy = transient
    ? RemovalPolicy.DESTROY
    : RemovalPolicy.RETAIN;

  const verificationString =
    'Hey {username}! Thanks for signing up to The Nutritionist Manchester. Your verification code is {####}';
  const invitationString =
    'Hey {username}! you have been invited to join The Nutritionist Manchester. Your temporary password is {####}';
  const userPool = new UserPool(context, 'user-pool', {
    removalPolicy,
    userPoolName: getResourceName('user-pool', environmentName),
    selfSignUpEnabled: true,

    userVerification: {
      emailBody: verificationString,
      emailSubject: 'TNM signup',
      emailStyle: VerificationEmailStyle.CODE,
      smsMessage: verificationString,
    },

    userInvitation: {
      emailSubject: 'TNM invite',
      emailBody: invitationString,
      smsMessage: invitationString,
    },

    signInAliases: {
      username: true,
      email: true,
      phone: true,
    },
  });

  new CfnOutput(context, 'UserPoolId', {
    value: userPool.userPoolId,
  });

  const client = userPool.addClient('Client', {
    disableOAuth: true,
  });

  new CfnOutput(context, 'ClientId', {
    value: client.userPoolClientId,
  });

  return { userPool };
};
