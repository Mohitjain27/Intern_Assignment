import { prisma } from '../config/prisma';
import { User } from '@prisma/client';

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { googleId } });
}

export async function createUser(data: {
  googleId?: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<User> {
  return prisma.user.create({ data });
}

export async function upsertUserByGoogleId(data: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<User> {
  return prisma.user.upsert({
    where: { googleId: data.googleId },
    update: {
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
    },
    create: {
      googleId: data.googleId,
      email: data.email,
      name: data.name,
      avatarUrl: data.avatarUrl,
    },
  });
}
