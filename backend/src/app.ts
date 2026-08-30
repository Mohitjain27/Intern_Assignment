import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { createBullBoardAdapter } from './queues/emailQueue';
import { basicAuth } from './middleware/authenticate';

import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import senderRoutes from './routes/sender.routes';
import slackRoutes from './routes/slack.routes';

const app = express();

// ============================================================
// Security middleware
// ============================================================
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Bull Board
}));

app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

app.use('/api', apiLimiter);

// ============================================================
// General middleware
// ============================================================
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// ============================================================
// Health check
// ============================================================
app.get('/health', async (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// ============================================================
// Bull Board (admin queue dashboard)
// ============================================================
const bullBoardAdapter = createBullBoardAdapter();

app.use(
  '/admin/queues',
  basicAuth(env.admin.username, env.admin.password),
  bullBoardAdapter.getRouter()
);

// ============================================================
// API Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/slack', slackRoutes);

// ============================================================
// Error handling
// ============================================================
app.use(notFound);
app.use(errorHandler);

export default app;
