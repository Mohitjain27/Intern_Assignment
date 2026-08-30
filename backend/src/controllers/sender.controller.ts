import { Request, Response } from 'express';
import * as senderRepo from '../repositories/sender.repository';
import { z } from 'zod';

const createSenderSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  isDefault: z.boolean().optional(),
});

export async function getSenders(req: Request, res: Response): Promise<void> {
  const senders = await senderRepo.findSendersByUser(req.userId!);
  res.json({ success: true, data: { senders } });
}

export async function createSender(req: Request, res: Response): Promise<void> {
  const parsed = createSenderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const sender = await senderRepo.createSender({
    userId: req.userId!,
    ...parsed.data,
  });

  res.status(201).json({ success: true, data: { sender } });
}
