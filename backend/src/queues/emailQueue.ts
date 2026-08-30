import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export const EMAIL_QUEUE_NAME = 'email-processing';

// Shared queue instance (used by API to add jobs)
let emailQueue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

export function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });
    console.log('✅ Email queue initialized');
  }
  return emailQueue;
}

export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
      connection: createRedisConnection(),
    });
  }
  return queueEvents;
}

export function createBullBoardAdapter(): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(getEmailQueue() as any) as any],
    serverAdapter,
  });

  return serverAdapter;
}

export async function addEmailJob(
  emailId: string,
  scheduledAt: Date,
  priority?: number
): Promise<string> {
  const queue = getEmailQueue();
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);

  const job = await queue.add(
    'process-email',
    { emailId },
    {
      jobId: `email_${emailId}`, // Idempotent job ID (no colons - BullMQ disallows them)
      delay,
      priority: priority || 0,
    }
  );

  return job.id!;
}

export async function removeEmailJob(emailId: string): Promise<void> {
  const queue = getEmailQueue();
  const job = await queue.getJob(`email_${emailId}`);
  if (job) {
    await job.remove();
  }
}

export async function closeQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close();
    emailQueue = null;
  }
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
}
