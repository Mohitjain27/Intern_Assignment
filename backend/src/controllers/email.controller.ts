import { Request, Response } from 'express';
import { scheduleCampaign } from '../services/campaign.service';
import * as emailRepo from '../repositories/email.repository';
import * as campaignRepo from '../repositories/campaign.repository';
import { searchEmails } from '../integrations/elasticsearch/emailIndex';
import { parseRecipients } from '../utils/csvParser';
import { z } from 'zod';

const scheduleSchema = z.object({
  senderId: z.string().min(1),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
  startTime: z.string().datetime(),
  delayBetweenEmails: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).max(1000000).optional().default(100000),
});

export async function scheduleEmail(req: Request, res: Response): Promise<void> {
  const body = { ...req.body };
  if (body.hourlyLimit === 0 || body.hourlyLimit === null || body.hourlyLimit === undefined) {
    delete body.hourlyLimit;
  }
  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const result = await scheduleCampaign({
    userId: req.userId!,
    senderId: parsed.data.senderId,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipients: parsed.data.recipients,
    startTime: new Date(parsed.data.startTime),
    delayBetweenEmails: parsed.data.delayBetweenEmails,
    hourlyLimit: parsed.data.hourlyLimit,
  });

  res.status(201).json({
    success: true,
    message: `Campaign scheduled with ${result.emailsScheduled} emails`,
    data: {
      campaignId: result.campaign.id,
      emailsScheduled: result.emailsScheduled,
      invalidEmails: result.invalidEmails,
      duplicates: result.duplicates,
    },
  });
}

export async function getScheduledEmails(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const { emails, total } = await emailRepo.findScheduledEmails(req.userId!, page, limit);

  res.json({
    success: true,
    data: {
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getSentEmails(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const { emails, total } = await emailRepo.findSentEmails(req.userId!, page, limit);

  res.json({
    success: true,
    data: {
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
}

export async function getEmailById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const email = await emailRepo.findEmailById(id, req.userId!);

  if (!email) {
    res.status(404).json({ success: false, message: 'Email not found' });
    return;
  }

  res.json({ success: true, data: { email } });
}

export async function searchEmailsHandler(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const { hits, total } = await searchEmails({
    q: req.query.q as string,
    status: req.query.status as string,
    sender: req.query.sender as string,
    from: req.query.from as string,
    to: req.query.to as string,
    userId: req.userId!,
    page,
    limit,
  });

  res.json({
    success: true,
    data: {
      emails: hits,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

export async function cancelEmail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await emailRepo.cancelEmail(id, req.userId!);
    res.json({ success: true, message: 'Email cancelled' });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
}

export async function uploadRecipients(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }

  const content = req.file.buffer.toString('utf-8');
  const result = parseRecipients(content, req.file.mimetype);

  res.json({
    success: true,
    data: {
      valid: result.valid,
      invalid: result.invalid,
      validCount: result.valid.length,
      invalidCount: result.invalid.length,
      duplicates: result.duplicates,
      total: result.total,
    },
  });
}

export async function getCampaigns(req: Request, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const { campaigns, total } = await campaignRepo.findCampaignsByUser(req.userId!, page, limit);

  res.json({
    success: true,
    data: {
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

export async function getCampaignById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const campaign = await campaignRepo.findCampaignById(id, req.userId!);

  if (!campaign) {
    res.status(404).json({ success: false, message: 'Campaign not found' });
    return;
  }

  res.json({ success: true, data: { campaign } });
}
