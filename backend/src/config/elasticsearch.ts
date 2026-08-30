import { Client } from '@elastic/elasticsearch';
import { env } from './env';

let esClient: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: env.elasticsearchUrl,
    });
  }
  return esClient;
}

export const EMAIL_INDEX = 'emails';

export async function initializeElasticsearch(): Promise<void> {
  const client = getElasticsearchClient();

  try {
    const ping = await client.ping();
    if (!ping) {
      throw new Error('Elasticsearch ping failed');
    }
    console.log('✅ Elasticsearch connected');

    // Create index if it doesn't exist
    const indexExists = await client.indices.exists({ index: EMAIL_INDEX });

    if (!indexExists) {
      await client.indices.create({
        index: EMAIL_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              senderName: { type: 'text', analyzer: 'email_analyzer' },
              recipient: {
                type: 'text',
                analyzer: 'email_analyzer',
                fields: { keyword: { type: 'keyword' } },
              },
              subject: { type: 'text', analyzer: 'email_analyzer' },
              body: { type: 'text', analyzer: 'email_analyzer' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' created`);
    } else {
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' already exists`);
    }
  } catch (error) {
    console.warn('⚠️ Elasticsearch not available - search features will be limited:', (error as Error).message);
    // Non-fatal - app continues without search
  }
}
