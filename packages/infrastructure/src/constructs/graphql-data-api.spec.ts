import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  haveResourceLike,
  expect as cdkExpect,
  SynthUtils,
  Capture,
} from '@aws-cdk/assert';
import { Schema } from '@aws-cdk/aws-appsync';
import { UserPool } from '@aws-cdk/aws-cognito';
import { App, Stack } from '@aws-cdk/core';
import { vol } from '../test-support';
import { GraphqlCrudResolver } from './graphql-crud-resolver';
import { GraphqlDataApi } from './graphql-data-api';

jest.mock('fs');
jest.mock('fs/promises');

describe('the graphql data api construct', () => {
  beforeEach(async () => {
    await fs.mkdir(os.tmpdir(), { recursive: true });
    await fs.mkdir(process.cwd(), { recursive: true });
    const fakeSchema = `
      type Customer {
        username: String!
        firstName: String!
        surname: String!
      }
    `;
    await fs.writeFile(path.join(process.cwd(), 'schema.graphql'), fakeSchema);
    await fs.mkdir(path.join(process.cwd(), 'handlers'));
  });

  afterEach(async () => {
    vol.reset();
  });

  it('Passes props through to the graphql api', async () => {
    const app = new App();
    const stackName = 'my-stack';
    const stack = new Stack(app, stackName);

    new GraphqlDataApi(stack, 'data-api', {
      name: 'data-api',
      handlersFolder: 'handlers',
      resolvers: [
        GraphqlCrudResolver.forEntity(stack, 'customers-resolver', 'customer'),
      ],
      schema: Schema.fromAsset(path.resolve(process.cwd(), 'schema.graphql')),
    });

    cdkExpect(stack).to(
      haveResourceLike('AWS::AppSync::GraphQLApi', {
        Name: 'data-api',
      }),
    );
  });

  it('Table inherits transience from API', async () => {
    const app = new App();
    const stackName = 'my-stack';
    const stack = new Stack(app, stackName);

    new GraphqlDataApi(stack, 'data-api', {
      name: 'data-api',
      handlersFolder: 'handlers',
      resolvers: [
        GraphqlCrudResolver.forEntity(stack, 'customers-resolver', 'customer'),
      ],
      transient: true,
      schema: Schema.fromAsset(path.resolve(process.cwd(), 'schema.graphql')),
    });

    const resources = Object.values(
      SynthUtils.toCloudFormation(stack).Resources,
    );

    const table: any = resources.find(
      (resource: any) => resource.Type === 'AWS::DynamoDB::Table',
    );
    expect(table.Properties.TableName).toEqual('data-api-customers-table');
    expect(table.UpdateReplacePolicy).toEqual('Delete');
    expect(table.DeletionPolicy).toEqual('Delete');
  });

  it('if a userpool is supplied, it generates a userpool authorisation config', () => {
    const app = new App();
    const stackName = 'my-stack';
    const stack = new Stack(app, stackName);
    const userPool = new UserPool(stack, 'user-pool');

    new GraphqlDataApi(stack, 'data-api', {
      name: 'data-api',
      handlersFolder: 'handlers',
      userPool,
      resolvers: [
        GraphqlCrudResolver.forEntity(stack, 'customers-resolver', 'customer'),
      ],
      schema: Schema.fromAsset(path.resolve(process.cwd(), 'schema.graphql')),
    });

    const userPoolRef = Capture.aString();

    cdkExpect(stack).to(
      haveResourceLike('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
        UserPoolConfig: {
          UserPoolId: {
            Ref: userPoolRef.capture(),
          },
        },
      }),
    );

    const resources = Object.entries(
      SynthUtils.toCloudFormation(stack).Resources,
    );

    const pool = resources.find(([key]) => key === userPoolRef.capturedValue);

    expect(pool).not.toBeUndefined();

    if (pool) {
      const resource = pool[1] as {
        Type: string;
        Properties: { [key: string]: string };
      };
      expect(resource.Type).toEqual('AWS::Cognito::UserPool');
    }
  });

  it('Creates a table for the entity which is not transient by default', async () => {
    const app = new App();
    const stackName = 'my-stack';
    const stack = new Stack(app, stackName);

    new GraphqlDataApi(stack, 'data-api', {
      name: 'data-api',
      handlersFolder: 'handlers',
      resolvers: [
        GraphqlCrudResolver.forEntity(stack, 'customers-resolver', 'customer'),
      ],
      schema: Schema.fromAsset(path.resolve(process.cwd(), 'schema.graphql')),
    });

    const resources = Object.values(
      SynthUtils.toCloudFormation(stack).Resources,
    );

    const table: any = resources.find(
      (resource: any) => resource.Type === 'AWS::DynamoDB::Table',
    );
    expect(table.Properties.TableName).toEqual('data-api-customers-table');
    expect(table.UpdateReplacePolicy).toEqual('Retain');
    expect(table.DeletionPolicy).toEqual('Retain');
  });

  it.each`
    name                | type
    ${'customers'}      | ${'Query'}
    ${'createCustomer'} | ${'Mutation'}
    ${'updateCustomer'} | ${'Mutation'}
    ${'deleteCustomer'} | ${'Mutation'}
  `(
    'creates a resolver a data source and a lambda for the $name $type which are all attached to the api',
    async ({ name, type }) => {
      const app = new App();
      const stackName = 'my-stack';
      const stack = new Stack(app, stackName);

      new GraphqlDataApi(stack, 'data-api', {
        name: 'data-api',
        handlersFolder: 'handlers',
        resolvers: [
          GraphqlCrudResolver.forEntity(
            stack,
            'customers-resolver',
            'customer',
          ),
        ],
        schema: Schema.fromAsset(path.resolve(process.cwd(), 'schema.graphql')),
      });

      cdkExpect(stack).to(
        haveResourceLike('AWS::Lambda::Function', {
          FunctionName: `data-api-${name}-${type.toLocaleLowerCase()}-resolver-lambda`,
          Handler: `${name}.handler`,
        }),
      );

      const lambdaKey = Capture.aString();

      cdkExpect(stack).to(
        haveResourceLike('AWS::AppSync::DataSource', {
          Name: `dataapi${name}${type.toLocaleLowerCase()}DataSource`,
          Type: 'AWS_LAMBDA',
          LambdaConfig: {
            LambdaFunctionArn: {
              'Fn::GetAtt': [lambdaKey.capture(), 'Arn'],
            },
          },
        }),
      );

      const resources = Object.entries(
        SynthUtils.toCloudFormation(stack).Resources,
      );
      const lambda = resources.find(([key]) => key === lambdaKey.capturedValue);
      expect(lambda).toBeDefined();

      if (lambda) {
        const resource = lambda[1] as {
          Type: string;
          Properties: { [key: string]: string };
        };
        expect(resource.Type).toEqual('AWS::Lambda::Function');
        expect(resource.Properties.FunctionName).toEqual(
          `data-api-${name}-${type.toLocaleLowerCase()}-resolver-lambda`,
        );
      }

      cdkExpect(stack).to(
        haveResourceLike('AWS::AppSync::Resolver', {
          FieldName: name,
          TypeName: type.charAt(0).toLocaleUpperCase() + type.slice(1),
          DataSourceName: `dataapi${name}${type.toLocaleLowerCase()}DataSource`,
        }),
      );
    },
  );
});
