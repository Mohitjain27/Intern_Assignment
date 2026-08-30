import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { prisma } from '../config/prisma';
import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try cookie first, then Authorization header
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace(/^Bearer\s+/, '');

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function basicAuth(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const base64 = authHeader.replace('Basic ', '');
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');

    if (user !== username || pass !== password) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    next();
  };
}
