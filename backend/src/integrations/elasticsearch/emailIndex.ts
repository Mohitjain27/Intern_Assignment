import { getElasticsearchClient, EMAIL_INDEX } from '../../config/elasticsearch';
import { Email } from '@prisma/client';

export interface EmailDocument {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface SearchParams {
  q?: string;
  status?: string;
  sender?: string;
  from?: string;
  to?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export async function indexEmail(
  email: Email & { sender: { email: string; name: string } }
): Promise<void> {
  try {
    const client = getElasticsearchClient();
    await client.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: {
        id: email.id,
        campaignId: email.campaignId,
        userId: email.userId,
        senderId: email.senderId,
        senderEmail: email.sender.email,
        senderName: email.sender.name,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
        createdAt: email.createdAt,
      } as EmailDocument,
    });
  } catch (error) {
    // Non-fatal - log but don't block
    console.warn('[Elasticsearch] Index failed:', (error as Error).message);
  }
}

export async function updateEmailIndex(
  emailId: string,
  updates: Partial<EmailDocument>
): Promise<void> {
  try {
    const client = getElasticsearchClient();
    await client.update({
      index: EMAIL_INDEX,
      id: emailId,
      doc: updates,
    });
  } catch (error) {
    console.warn('[Elasticsearch] Update failed:', (error as Error).message);
  }
}

export async function searchEmails(params: SearchParams): Promise<{
  hits: EmailDocument[];
  total: number;
}> {
  try {
    const client = getElasticsearchClient();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const from = (page - 1) * limit;

    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    // Text search
    if (params.q) {
      must.push({
        multi_match: {
          query: params.q,
          fields: ['recipient^2', 'subject^3', 'body', 'senderName'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Filter by user
    if (params.userId) {
      filter.push({ term: { userId: params.userId } });
    }

    // Filter by status
    if (params.status) {
      filter.push({ term: { status: params.status.toUpperCase() } });
    }

    // Filter by sender
    if (params.sender) {
      filter.push({ term: { senderEmail: params.sender } });
    }

    // Date range
    if (params.from || params.to) {
      const range: Record<string, string> = {};
      if (params.from) range.gte = params.from;
      if (params.to) range.lte = params.to;
      filter.push({ range: { scheduledAt: range } });
    }

    const response = await client.search({
      index: EMAIL_INDEX,
      from,
      size: limit,
      sort: [{ scheduledAt: { order: 'desc' } }],
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          filter,
        },
      },
    });

    const hits = response.hits.hits.map((hit) => hit._source as EmailDocument);
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || 0;

    return { hits, total };
  } catch (error) {
    console.warn('[Elasticsearch] Search failed:', (error as Error).message);
    return { hits: [], total: 0 };
  }
}

export async function deleteEmailFromIndex(emailId: string): Promise<void> {
  try {
    const client = getElasticsearchClient();
    await client.delete({ index: EMAIL_INDEX, id: emailId });
  } catch (error) {
    console.warn('[Elasticsearch] Delete failed:', (error as Error).message);
  }
}
