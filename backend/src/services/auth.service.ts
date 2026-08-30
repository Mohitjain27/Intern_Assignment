import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import * as userRepo from '../repositories/user.repository';
import * as senderRepo from '../repositories/sender.repository';
import { signToken } from '../utils/jwt';
import { User } from '@prisma/client';

const oauthClient = new OAuth2Client(
  env.google.clientId,
  env.google.clientSecret,
  env.google.callbackUrl
);

export function getGoogleAuthUrl(): string {
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });
}

export async function handleGoogleCallback(code: string): Promise<{
  user: User;
  token: string;
}> {
  // Exchange code for tokens
  const { tokens } = await oauthClient.getToken(code);
  oauthClient.setCredentials(tokens);

  // Get user info from Google
  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: env.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Invalid Google token payload');

  const { sub: googleId, email, name, picture: avatarUrl } = payload;

  if (!email || !name || !googleId) {
    throw new Error('Missing required Google profile fields');
  }

  // Upsert user
  const user = await userRepo.upsertUserByGoogleId({
    googleId,
    email,
    name,
    avatarUrl,
  });

  // Ensure user has a default sender
  await senderRepo.ensureDefaultSender(user.id, user.email, user.name);

  // Generate JWT
  const token = signToken({ userId: user.id, email: user.email });

  return { user, token };
}
