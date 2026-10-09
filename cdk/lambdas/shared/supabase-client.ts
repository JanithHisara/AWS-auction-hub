import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const secretsClient = new SecretsManagerClient({});

let cachedClient: SupabaseClient | null = null;
let cachedSecretArn: string | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient> {
  const secretArn = process.env.SUPABASE_SECRET_ARN;
  if (!secretArn) {
    throw new Error('SUPABASE_SECRET_ARN environment variable is not set');
  }

  if (cachedClient && cachedSecretArn === secretArn) {
    return cachedClient;
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!response.SecretString) {
    throw new Error('Failed to retrieve Supabase secret');
  }

  const secret = JSON.parse(response.SecretString) as {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  };

  cachedClient = createClient(secret.SUPABASE_URL, secret.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  cachedSecretArn = secretArn;
  return cachedClient;
}
