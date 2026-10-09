import {
  IoTDataPlaneClient,
  PublishCommand,
} from '@aws-sdk/client-iot-data-plane';
import { IoTClient, DescribeEndpointCommand } from '@aws-sdk/client-iot';

let iotDataClient: IoTDataPlaneClient | null = null;

async function getIoTEndpoint(): Promise<string> {
  if (process.env.AWS_IOT_ENDPOINT) {
    return process.env.AWS_IOT_ENDPOINT;
  }

  const iotClient = new IoTClient({});
  const response = await iotClient.send(
    new DescribeEndpointCommand({ endpointType: 'iot:Data-ATS' }),
  );

  const endpoint = response.endpointAddress;
  if (!endpoint) {
    throw new Error('Could not resolve IoT Data endpoint');
  }

  process.env.AWS_IOT_ENDPOINT = endpoint;
  return endpoint;
}

async function getClient(): Promise<IoTDataPlaneClient> {
  if (iotDataClient) return iotDataClient;

  const endpoint = await getIoTEndpoint();
  iotDataClient = new IoTDataPlaneClient({
    endpoint: `https://${endpoint}`,
  });
  return iotDataClient;
}

export async function publishToDevice(deviceId: string, topic: string, payload: unknown): Promise<void> {
  const client = await getClient();
  const fullTopic = `gem-auction/${deviceId}/${topic}`;

  await client.send(
    new PublishCommand({
      topic: fullTopic,
      payload: Buffer.from(JSON.stringify(payload)),
      qos: 1,
    }),
  );

  console.log(`Published to ${fullTopic}`);
}
