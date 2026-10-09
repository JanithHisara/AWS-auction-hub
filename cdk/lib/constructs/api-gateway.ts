import { Construct } from 'constructs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface WebhookApiProps {
  auctionUpdaterHandler: lambda.IFunction;
}

export class WebhookApi extends Construct {
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly webhookUrl: string;

  constructor(scope: Construct, id: string, props: WebhookApiProps) {
    super(scope, id);

    this.httpApi = new apigatewayv2.HttpApi(this, 'AuctionWebhookApi', {
      apiName: 'gem-auction-webhook-api',
      description: 'Receives Supabase database webhooks for real-time device updates',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const updaterIntegration = new integrations.HttpLambdaIntegration(
      'AuctionUpdaterIntegration',
      props.auctionUpdaterHandler,
    );

    this.httpApi.addRoutes({
      path: '/webhook/auction-update',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: updaterIntegration,
    });

    this.webhookUrl = `${this.httpApi.apiEndpoint}/webhook/auction-update`;
  }
}
