import { Request, Response } from 'express';
import { getGoogleAuthUrl, handleGoogleCallback } from '../services/auth.service';
import { env } from '../config/env';

export async function googleLogin(req: Request, res: Response): Promise<void> {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.redirect(`${env.frontendUrl}/login?error=missing_code`);
      return;
    }

    const { user, token } = await handleGoogleCallback(code);

    // Set JWT as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${env.frontendUrl}/dashboard?login=success`);
  } catch (error) {
    console.error('[Auth] Google callback error:', error);
    res.redirect(`${env.frontendUrl}/login?error=auth_failed`);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = req.user as any;
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
}

export async function devLogin(req: Request, res: Response): Promise<void> {
  try {
    const { prisma } = await import('../config/prisma');
    const { ensureDefaultSender } = await import('../repositories/sender.repository');
    const { signToken } = await import('../utils/jwt');

    const email = (req.body.email || 'oliver.brown@domain.io').trim().toLowerCase();
    let name = 'Oliver Brown';
    let avatarUrl: string | undefined = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100';

    if (email !== 'oliver.brown@domain.io') {
      const parts = email.split('@')[0].split(/[._-]+/);
      name = parts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      avatarUrl = undefined;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        avatarUrl,
      },
      create: {
        email,
        name,
        avatarUrl,
      },
    });

    await ensureDefaultSender(user.id, user.email, user.name);

    const token = signToken({ userId: user.id, email: user.email });

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error('[Auth] Dev login error:', error);
    res.status(500).json({ success: false, message: 'Dev login failed' });
  }
}
