import { prisma } from '../config/prisma';
import { Sender } from '@prisma/client';

export async function findSendersByUser(userId: string): Promise<Sender[]> {
  return prisma.sender.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function findSenderById(id: string, userId: string): Promise<Sender | null> {
  return prisma.sender.findFirst({ where: { id, userId } });
}

export async function createSender(data: {
  userId: string;
  name: string;
  email: string;
  isDefault?: boolean;
}): Promise<Sender> {
  // If setting as default, unset others first
  if (data.isDefault) {
    await prisma.sender.updateMany({
      where: { userId: data.userId },
      data: { isDefault: false },
    });
  }

  return prisma.sender.create({ data });
}

export async function ensureDefaultSender(userId: string, userEmail: string, userName: string): Promise<Sender> {
  const existing = await prisma.sender.findFirst({ where: { userId, isDefault: true } });
  if (existing) return existing;

  return prisma.sender.create({
    data: {
      userId,
      name: userName,
      email: userEmail,
      isDefault: true,
    },
  });
}
