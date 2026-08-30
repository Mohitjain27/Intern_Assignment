import { prisma } from '../config/prisma';
import { Email, EmailStatus, Prisma } from '@prisma/client';
import { addEmailJob } from '../queues/emailQueue';
import { indexEmail } from '../integrations/elasticsearch/emailIndex';

export interface CreateEmailData {
  campaignId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  sequenceNumber: number;
}

export async function createEmail(data: CreateEmailData): Promise<Email> {
  const email = await prisma.email.create({
    data: {
      ...data,
      status: EmailStatus.SCHEDULED,
    },
    include: { sender: true },
  });

  // Add to BullMQ
  const jobId = await addEmailJob(email.id, email.scheduledAt, email.sequenceNumber);

  // Save job ID
  await prisma.email.update({
    where: { id: email.id },
    data: { jobId },
  });

  // Index in Elasticsearch (fire and forget)
  indexEmail(email as Email & { sender: { email: string; name: string } }).catch(console.warn);

  return email;
}

export async function bulkCreateEmails(
  emails: CreateEmailData[],
  batchSize = 50
): Promise<void> {
  // Process in batches to avoid overwhelming the DB
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    // Create emails in DB
    const created = await Promise.all(
      batch.map((data) =>
        prisma.email.create({
          data: { ...data, status: EmailStatus.SCHEDULED },
          include: { sender: true },
        })
      )
    );

    // Add jobs to BullMQ and update job IDs
    await Promise.all(
      created.map(async (email) => {
        const jobId = await addEmailJob(email.id, email.scheduledAt, email.sequenceNumber);
        await prisma.email.update({ where: { id: email.id }, data: { jobId } });
        indexEmail(email as Email & { sender: { email: string; name: string } }).catch(console.warn);
      })
    );

    console.log(`[Scheduler] Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}`);
  }
}

export async function findEmailById(
  id: string,
  userId?: string
): Promise<Email | null> {
  return prisma.email.findFirst({
    where: { id, ...(userId && { userId }) },
    include: { sender: true, campaign: true },
  });
}

export async function findScheduledEmails(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ emails: Email[]; total: number }> {
  const where: Prisma.EmailWhereInput = {
    userId,
    status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING, EmailStatus.RATE_LIMITED] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      include: { sender: true },
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return { emails, total };
}

export async function findSentEmails(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ emails: Email[]; total: number }> {
  const where: Prisma.EmailWhereInput = {
    userId,
    status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      include: { sender: true },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return { emails, total };
}

export async function cancelEmail(id: string, userId: string): Promise<void> {
  const email = await prisma.email.findFirst({
    where: { id, userId, status: EmailStatus.SCHEDULED },
  });

  if (!email) {
    throw new Error('Email not found or cannot be cancelled');
  }

  // Remove BullMQ job
  const { removeEmailJob } = await import('../queues/emailQueue');
  await removeEmailJob(id);

  await prisma.email.update({
    where: { id },
    data: { status: EmailStatus.FAILED, errorMessage: 'Cancelled by user' },
  });
}
