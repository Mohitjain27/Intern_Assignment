import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, addEmailJob } from '../queues/emailQueue';
import { getEmailProvider } from '../integrations/email/ethereal';
import { indexEmail, updateEmailIndex } from '../integrations/elasticsearch/emailIndex';
import { sendRateLimitNotification } from '../integrations/slack/notifications';
import {
  checkAndIncrementHourlyLimit,
  acquireMinDelaySlot,
  msUntilNextHour,
} from '../utils/rateLimiter';
import { EmailStatus } from '@prisma/client';

interface EmailJobData {
  emailId: string;
}

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;
  console.log(`[Worker] Processing email ${emailId} (attempt ${job.attemptsMade + 1})`);

  // ============================================================
  // STEP 1: Atomic status transition SCHEDULED → PROCESSING
  // This prevents duplicate sends across concurrent workers
  // ============================================================
  const email = await prisma.$transaction(async (tx) => {
    const existing = await tx.email.findUnique({
      where: { id: emailId },
      include: { sender: true, campaign: true },
    });

    if (!existing) {
      throw new Error(`Email ${emailId} not found`);
    }

    // Idempotency check: only process SCHEDULED emails
    if (existing.status === EmailStatus.SENT) {
      console.log(`[Worker] Email ${emailId} already SENT, skipping`);
      return null; // Signal to skip
    }

    if (existing.status === EmailStatus.PROCESSING) {
      console.log(`[Worker] Email ${emailId} already PROCESSING (possible duplicate job)`);
      return null; // Another worker has it
    }

    if (existing.status === EmailStatus.FAILED) {
      if (existing.attempts >= existing.maxAttempts) {
        console.log(`[Worker] Email ${emailId} max attempts reached, skipping`);
        return null;
      }
    }

    // Transition to PROCESSING
    return tx.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.PROCESSING,
        attempts: { increment: 1 },
      },
      include: { sender: true, campaign: true },
    });
  });

  if (!email) return; // Already processed or skipped

  try {
    // ============================================================
    // STEP 2: Check hourly rate limit (per sender)
    // ============================================================
    const { allowed, resetAt } = await checkAndIncrementHourlyLimit(
      email.senderId,
      email.campaign.hourlyLimit
    );

    if (!allowed) {
      console.log(
        `[Worker] Rate limit hit for sender ${email.sender.email}. Rescheduling for ${resetAt.toISOString()}`
      );

      // Mark as RATE_LIMITED and reschedule
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.RATE_LIMITED,
          errorMessage: `Hourly rate limit reached. Rescheduled for ${resetAt.toISOString()}`,
        },
      });

      await updateEmailIndex(emailId, {
        status: EmailStatus.RATE_LIMITED,
      });

      // Reschedule BullMQ job for next hour window
      const delayMs = msUntilNextHour() + (email.sequenceNumber % 60) * 1000; // Spread within next minute
      await addEmailJob(emailId, new Date(Date.now() + delayMs));

      // Update DB to SCHEDULED again (after rescheduling)
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() + delayMs),
        },
      });

      // Send Slack notification (idempotent - once per hour per sender)
      await sendRateLimitNotification(
        email.userId,
        email.senderId,
        email.sender.email,
        email.campaign.hourlyLimit
      );

      return;
    }

    // ============================================================
    // STEP 3: Enforce minimum delay between sends (per sender)
    // Uses Redis NX lock - safe across multiple workers
    // ============================================================
    const slotAcquired = await acquireMinDelaySlot(email.senderId, email.campaign.delayBetweenEmails);

    if (!slotAcquired) {
      // Still within minimum delay window - brief retry
      const retryDelay = Math.max(email.campaign.delayBetweenEmails, 500);
      console.log(`[Worker] Minimum delay not elapsed for sender ${email.sender.email}. Retrying in ${retryDelay}ms`);

      // Revert to SCHEDULED and re-add with short delay
      await prisma.email.update({
        where: { id: emailId },
        data: { status: EmailStatus.SCHEDULED },
      });

      await addEmailJob(emailId, new Date(Date.now() + retryDelay));
      return;
    }

    // ============================================================
    // STEP 4: Send the email
    // ============================================================
    const emailProvider = getEmailProvider();

    const result = await emailProvider.send({
      from: email.sender.email,
      fromName: email.sender.name,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    // ============================================================
    // STEP 5: Mark as SENT
    // ============================================================
    const sentAt = new Date();

    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.SENT,
        sentAt,
        providerMessageId: result.messageId,
        errorMessage: null,
      },
    });

    // Update campaign sent count
    await prisma.emailCampaign.update({
      where: { id: email.campaignId },
      data: { sentCount: { increment: 1 } },
    });

    // Update Elasticsearch
    await updateEmailIndex(emailId, {
      status: EmailStatus.SENT,
      sentAt,
    });

    console.log(
      `[Worker] ✅ Email ${emailId} sent to ${email.recipient}. Message ID: ${result.messageId}`,
      result.previewUrl ? `Preview: ${result.previewUrl}` : ''
    );

    // Check if campaign is complete
    await checkCampaignCompletion(email.campaignId);

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[Worker] ❌ Email ${emailId} failed:`, errorMessage);

    // Increment failure count and determine status
    const updatedEmail = await prisma.email.findUnique({ where: { id: emailId } });

    if (updatedEmail && updatedEmail.attempts >= updatedEmail.maxAttempts) {
      // Max retries exhausted
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.FAILED,
          errorMessage,
        },
      });

      await prisma.emailCampaign.update({
        where: { id: updatedEmail.campaignId },
        data: { failedCount: { increment: 1 } },
      });

      await updateEmailIndex(emailId, {
        status: EmailStatus.FAILED,
      });
    } else {
      // Revert to SCHEDULED for retry by BullMQ
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SCHEDULED,
          errorMessage,
        },
      });
    }

    throw error; // Let BullMQ handle retry
  }
}

async function checkCampaignCompletion(campaignId: string): Promise<void> {
  const stats = await prisma.email.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: true,
  });

  const total = stats.reduce((sum, s) => sum + s._count, 0);
  const completed = stats
    .filter((s) => s.status === EmailStatus.SENT || s.status === EmailStatus.FAILED)
    .reduce((sum, s) => sum + s._count, 0);

  if (completed === total) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' },
    });
  }
}

let worker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.worker.concurrency,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        // Exponential backoff: 5s, 25s, 125s...
        return Math.min(5000 * Math.pow(5, attemptsMade), 300000);
      },
    },
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);
  });

  worker.on('error', (error) => {
    console.error('[Worker] Worker error:', error);
  });

  console.log(
    `✅ Email worker started (concurrency: ${env.worker.concurrency}, minDelay: ${env.worker.minEmailDelayMs}ms)`
  );

  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Email worker stopped');
  }
}
