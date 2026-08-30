import { WebClient } from '@slack/web-api';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { checkAndMarkRateLimitNotified } from '../../utils/rateLimiter';

export function getSlackOAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: env.slack.clientId,
    scope: 'chat:write,channels:read,chat:write.public',
    redirect_uri: env.slack.redirectUri,
    ...(state && { state }),
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string): Promise<{
  teamId: string;
  teamName: string;
  accessToken: string;
  botUserId?: string;
  channelId?: string;
  channelName?: string;
}> {
  const client = new WebClient();

  const result = await client.oauth.v2.access({
    client_id: env.slack.clientId,
    client_secret: env.slack.clientSecret,
    redirect_uri: env.slack.redirectUri,
    code,
  });

  if (!result.ok || !result.access_token) {
    throw new Error('Slack OAuth exchange failed: ' + result.error);
  }

  // Get default channel (general or first available)
  let channelId: string | undefined;
  let channelName: string | undefined;

  try {
    const botClient = new WebClient(result.access_token);
    const channels = await botClient.conversations.list({
      types: 'public_channel',
      limit: 20,
    });

    if (channels.channels && channels.channels.length > 0) {
      // Prefer #general, fallback to first channel
      const general = channels.channels.find((c) => c.name === 'general');
      const channel = general || channels.channels[0];
      channelId = channel.id;
      channelName = channel.name;
    }
  } catch (err) {
    console.warn('[Slack] Could not fetch channels:', err);
  }

  return {
    teamId: result.team?.id || '',
    teamName: result.team?.name || '',
    accessToken: result.access_token,
    botUserId: result.bot_user_id,
    channelId,
    channelName,
  };
}

export async function sendRateLimitNotification(
  userId: string,
  senderId: string,
  senderEmail: string,
  hourlyLimit: number
): Promise<void> {
  try {
    // Check idempotency - only notify once per sender per hour
    const shouldNotify = await checkAndMarkRateLimitNotified(senderId);
    if (!shouldNotify) {
      console.log(`[Slack] Rate limit notification already sent for sender ${senderEmail} this hour`);
      return;
    }

    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.isActive) {
      console.log('[Slack] No active Slack connection for user:', userId);
      return;
    }

    const client = new WebClient(connection.accessToken);
    const channelId = connection.channelId;

    if (!channelId) {
      console.warn('[Slack] No channel configured for notifications');
      return;
    }

    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

    await client.chat.postMessage({
      channel: channelId,
      text: `🚦 *Email Rate Limit Reached*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚦 Email Rate Limit Reached',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${senderEmail}`,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Limit:*\n${hourlyLimit} emails/hour`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Remaining emails will be automatically rescheduled to the next available window (~${nextHour.toLocaleTimeString()}).`,
          },
        },
      ],
    });

    console.log(`[Slack] Rate limit notification sent for sender ${senderEmail}`);
  } catch (error) {
    // Non-fatal - log but continue
    console.warn('[Slack] Notification failed:', (error as Error).message);
  }
}

export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.slackConnection.update({
    where: { userId },
    data: { isActive: false },
  });
}
