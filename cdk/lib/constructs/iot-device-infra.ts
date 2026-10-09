import { Construct } from 'constructs';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

export interface IoTDeviceInfraProps {
  nfcScanHandler: lambda.IFunction;
  bidHandler: lambda.IFunction;
  heartbeatHandler: lambda.IFunction;
}

export class IoTDeviceInfra extends Construct {
  public readonly thingType: iot.CfnThingType;

  constructor(scope: Construct, id: string, props: IoTDeviceInfraProps) {
    super(scope, id);

    this.thingType = new iot.CfnThingType(this, 'GemAuctionDeviceType', {
      thingTypeName: 'GemAuctionDevice',
      thingTypeProperties: {
        searchableAttributes: ['deviceId', 'firmwareVersion', 'hardwareVersion'],
        thingTypeDescription: 'ESP32 handheld bidding device for gem auctions',
      },
    });

    new iot.CfnPolicy(this, 'DevicePolicy', {
      policyName: 'GemAuctionDevicePolicy',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'iot:Connect',
            Resource: '*',
          },
          {
            Effect: 'Allow',
            Action: 'iot:Publish',
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/\${iot:Connection.Thing.ThingName}/nfc/scan`,
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/\${iot:Connection.Thing.ThingName}/bid/submit`,
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/\${iot:Connection.Thing.ThingName}/heartbeat`,
            ],
          },
          {
            Effect: 'Allow',
            Action: 'iot:Subscribe',
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topicfilter/gem-auction/\${iot:Connection.Thing.ThingName}/state`,
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topicfilter/gem-auction/\${iot:Connection.Thing.ThingName}/auction/update`,
            ],
          },
          {
            Effect: 'Allow',
            Action: 'iot:Receive',
            Resource: [
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/\${iot:Connection.Thing.ThingName}/state`,
              `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:topic/gem-auction/\${iot:Connection.Thing.ThingName}/auction/update`,
            ],
          },
        ],
      },
    });

    const nfcRuleRole = new iam.Role(this, 'NfcScanRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });
    props.nfcScanHandler.grantInvoke(nfcRuleRole);

    new iot.CfnTopicRule(this, 'NfcScanRule', {
      ruleName: 'gem_auction_nfc_scan',
      topicRulePayload: {
        sql: "SELECT *, topic(2) AS device_id FROM 'gem-auction/+/nfc/scan'",
        actions: [
          {
            lambda: {
              functionArn: props.nfcScanHandler.functionArn,
            },
          },
        ],
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        description: 'Routes NFC scan events from devices to the nfc-scan-handler Lambda',
      },
    });

    props.nfcScanHandler.addPermission('AllowIoTNfcInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/gem_auction_nfc_scan`,
    });

    const bidRuleRole = new iam.Role(this, 'BidRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });
    props.bidHandler.grantInvoke(bidRuleRole);

    new iot.CfnTopicRule(this, 'BidSubmitRule', {
      ruleName: 'gem_auction_bid_submit',
      topicRulePayload: {
        sql: "SELECT *, topic(2) AS device_id FROM 'gem-auction/+/bid/submit'",
        actions: [
          {
            lambda: {
              functionArn: props.bidHandler.functionArn,
            },
          },
        ],
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        description: 'Routes bid submissions from devices to the bid-handler Lambda',
      },
    });

    props.bidHandler.addPermission('AllowIoTBidInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/gem_auction_bid_submit`,
    });

    const heartbeatRuleRole = new iam.Role(this, 'HeartbeatRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });
    props.heartbeatHandler.grantInvoke(heartbeatRuleRole);

    new iot.CfnTopicRule(this, 'HeartbeatRule', {
      ruleName: 'gem_auction_heartbeat',
      topicRulePayload: {
        sql: "SELECT *, topic(2) AS device_id FROM 'gem-auction/+/heartbeat'",
        actions: [
          {
            lambda: {
              functionArn: props.heartbeatHandler.functionArn,
            },
          },
        ],
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        description: 'Routes heartbeat messages from devices to the heartbeat-handler Lambda',
      },
    });

    props.heartbeatHandler.addPermission('AllowIoTHeartbeatInvoke', {
      principal: new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn: `arn:aws:iot:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/gem_auction_heartbeat`,
    });
  }
}
