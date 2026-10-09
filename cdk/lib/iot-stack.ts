import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IoTDeviceInfra } from './constructs/iot-device-infra';
import { LambdaFunctions } from './constructs/lambda-functions';
import { WebhookApi } from './constructs/api-gateway';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class GemAuctionIotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const supabaseUrl = this.node.tryGetContext('supabaseUrl') || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = this.node.tryGetContext('supabaseServiceKey') || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const supabaseSecret = new secretsmanager.Secret(this, 'SupabaseSecret', {
      secretName: 'gem-auction/supabase',
      description: 'Supabase connection credentials for IoT Lambda functions',
      secretObjectValue: {
        SUPABASE_URL: cdk.SecretValue.unsafePlainText(supabaseUrl),
        SUPABASE_SERVICE_ROLE_KEY: cdk.SecretValue.unsafePlainText(supabaseServiceKey),
      },
    });

    const lambdas = new LambdaFunctions(this, 'LambdaFunctions', {
      supabaseSecret,
    });

    new IoTDeviceInfra(this, 'IoTDeviceInfra', {
      nfcScanHandler: lambdas.nfcScanHandler,
      bidHandler: lambdas.bidHandler,
      heartbeatHandler: lambdas.heartbeatHandler,
    });

    const webhookApi = new WebhookApi(this, 'WebhookApi', {
      auctionUpdaterHandler: lambdas.auctionUpdaterHandler,
    });

    new cdk.CfnOutput(this, 'WebhookEndpoint', {
      value: webhookApi.webhookUrl,
      description: 'Supabase webhook endpoint for auction updates',
    });

    new cdk.CfnOutput(this, 'SupabaseSecretArn', {
      value: supabaseSecret.secretArn,
      description: 'ARN of the Supabase credentials secret',
    });
  }
}
