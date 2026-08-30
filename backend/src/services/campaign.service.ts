import * as campaignRepo from '../repositories/campaign.repository';
import * as emailRepo from '../repositories/email.repository';
import { validateEmailList } from '../utils/csvParser';
import { EmailCampaign } from '@prisma/client';

export interface ScheduleCampaignInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmails: number; // ms
  hourlyLimit: number;
}

export interface ScheduleResult {
  campaign: EmailCampaign;
  emailsScheduled: number;
  invalidEmails: number;
  duplicates: number;
}

export async function scheduleCampaign(
  input: ScheduleCampaignInput
): Promise<ScheduleResult> {
  // Validate and clean recipients
  const { valid, invalid, duplicates } = validateEmailList(input.recipients);

  if (valid.length === 0) {
    throw new Error('No valid email recipients found');
  }

  // Create campaign
  const campaign = await campaignRepo.createCampaign({
    userId: input.userId,
    senderId: input.senderId,
    subject: input.subject,
    body: input.body,
    startTime: input.startTime,
    delayBetweenEmails: input.delayBetweenEmails,
    hourlyLimit: input.hourlyLimit,
    totalEmails: valid.length,
  });

  // Create individual email records with scheduled times
  const emailsToCreate = valid.map((recipient, index) => {
    const scheduledAt = new Date(
      input.startTime.getTime() + index * input.delayBetweenEmails
    );

    return {
      campaignId: campaign.id,
      userId: input.userId,
      senderId: input.senderId,
      recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt,
      sequenceNumber: index,
    };
  });

  // Bulk create with BullMQ delayed jobs
  await emailRepo.bulkCreateEmails(emailsToCreate);

  return {
    campaign,
    emailsScheduled: valid.length,
    invalidEmails: invalid.length,
    duplicates,
  };
}
