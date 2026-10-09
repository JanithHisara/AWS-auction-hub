import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';

export interface LambdaFunctionsProps {
  supabaseSecret: secretsmanager.ISecret;
}

export class LambdaFunctions extends Construct {
  public readonly nfcScanHandler: lambda.IFunction;
  public readonly bidHandler: lambda.IFunction;
  public readonly heartbeatHandler: lambda.IFunction;
  public readonly auctionUpdaterHandler: lambda.IFunction;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    const commonEnv: Record<string, string> = {
      SUPABASE_SECRET_ARN: props.supabaseSecret.secretArn,
      AWS_IOT_ENDPOINT: '', // Set after deployment or via SSM
      NODE_OPTIONS: '--enable-source-maps',
    };

    const commonBundling: nodejs.BundlingOptions = {
      minify: true,
      sourceMap: true,
      target: 'node20',
      format: nodejs.OutputFormat.CJS,
      externalModules: ['@aws-sdk/*'],
    };

    const iotPublishPolicy = new iam.PolicyStatement({
      actions: ['iot:Publish'],
      resources: [`arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/*`],
    });

    const iotDescribePolicy = new iam.PolicyStatement({
      actions: ['iot:DescribeEndpoint'],
      resources: ['*'],
    });

    this.nfcScanHandler = new nodejs.NodejsFunction(this, 'NfcScanHandler', {
      functionName: 'gem-auction-nfc-scan-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambdas/nfc-scan-handler/index.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: commonEnv,
      bundling: commonBundling,
    });

    this.bidHandler = new nodejs.NodejsFunction(this, 'BidHandler', {
      functionName: 'gem-auction-bid-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambdas/bid-handler/index.ts'),
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      environment: commonEnv,
      bundling: commonBundling,
    });

    this.heartbeatHandler = new nodejs.NodejsFunction(this, 'HeartbeatHandler', {
      functionName: 'gem-auction-heartbeat-handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambdas/heartbeat-handler/index.ts'),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: commonEnv,
      bundling: commonBundling,
    });

    this.auctionUpdaterHandler = new nodejs.NodejsFunction(this, 'AuctionUpdaterHandler', {
      functionName: 'gem-auction-auction-updater',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambdas/auction-updater/index.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
      bundling: commonBundling,
    });

    for (const fn of [this.nfcScanHandler, this.bidHandler, this.heartbeatHandler, this.auctionUpdaterHandler]) {
      props.supabaseSecret.grantRead(fn);
      fn.addToRolePolicy(iotPublishPolicy);
      fn.addToRolePolicy(iotDescribePolicy);
    }
  }
}
