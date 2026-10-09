#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GemAuctionIotStack } from '../lib/iot-stack';

const app = new cdk.App();

new GemAuctionIotStack(app, 'GemAuctionIotStack', {
  env: {
    account: '238323585125',
    region: 'ap-southeast-1',
  },
  description: 'Gem Auction IoT infrastructure - ESP32 devices, MQTT, Lambda handlers',
});
