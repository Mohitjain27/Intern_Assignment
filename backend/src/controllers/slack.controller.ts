import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  getSlackOAuthUrl,
  exchangeSlackCode,
  disconnectSlack,
} from '../integrations/slack/notifications';
import { env } from '../config/env';

export async function getSlackStatus(req: Request, res: Response): Promise<void> {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId: req.userId! },
  });

  res.json({
    success: true,
    data: {
      connected: connection?.isActive || false,
      teamName: connection?.teamName || null,
      channelName: connection?.channelName || null,
    },
  });
}

export async function connectSlack(req: Request, res: Response): Promise<void> {
  const state = req.userId!; // Use userId as state for OAuth security
  const url = getSlackOAuthUrl(state);
  res.json({ success: true, data: { url } });
}

export async function slackCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
      return;
    }

    const slackData = await exchangeSlackCode(code as string);

    await prisma.slackConnection.upsert({
      where: { userId: userId as string },
      update: {
        teamId: slackData.teamId,
        teamName: slackData.teamName,
        accessToken: slackData.accessToken,
        botUserId: slackData.botUserId,
        channelId: slackData.channelId,
        channelName: slackData.channelName,
        isActive: true,
      },
      create: {
        userId: userId as string,
        teamId: slackData.teamId,
        teamName: slackData.teamName,
        accessToken: slackData.accessToken,
        botUserId: slackData.botUserId,
        channelId: slackData.channelId,
        channelName: slackData.channelName,
        isActive: true,
      },
    });

    res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
  } catch (error) {
    console.error('[Slack] Callback error:', error);
    res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }
}

export async function disconnectSlackHandler(req: Request, res: Response): Promise<void> {
  await disconnectSlack(req.userId!);
  res.json({ success: true, message: 'Slack disconnected' });
}
