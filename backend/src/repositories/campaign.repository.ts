import { prisma } from '../config/prisma';
import { EmailCampaign, Prisma } from '@prisma/client';

export interface CreateCampaignData {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
  totalEmails: number;
}

export async function createCampaign(data: CreateCampaignData): Promise<EmailCampaign> {
  return prisma.emailCampaign.create({ data });
}

export async function findCampaignById(
  id: string,
  userId?: string
): Promise<EmailCampaign | null> {
  return prisma.emailCampaign.findFirst({
    where: { id, ...(userId && { userId }) },
    include: { sender: true, _count: { select: { emails: true } } },
  });
}

export async function findCampaignsByUser(
  userId: string,
  page = 1,
  limit = 20
): Promise<{ campaigns: EmailCampaign[]; total: number }> {
  const where: Prisma.EmailCampaignWhereInput = { userId };

  const [campaigns, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      include: { sender: true, _count: { select: { emails: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  return { campaigns, total };
}
