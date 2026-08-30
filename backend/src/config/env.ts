import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://:redis@localhost:6379'),
  REDIS_PASSWORD: z.string().default('redis'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string(),
  SLACK_CLIENT_SECRET: z.string(),
  SLACK_REDIRECT_URI: z.string(),

  // Ethereal Email
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.string().default('587'),
  ETHEREAL_USER: z.string(),
  ETHEREAL_PASSWORD: z.string(),
  ETHEREAL_FROM_NAME: z.string().default('Email Scheduler'),

  // Worker
  WORKER_CONCURRENCY: z.string().default('5'),
  MIN_EMAIL_DELAY_MS: z.string().default('2000'),
  MAX_EMAILS_PER_HOUR: z.string().default('200'),

  // Admin
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin123'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  port: parseInt(parsed.data.PORT),
  nodeEnv: parsed.data.NODE_ENV,
  frontendUrl: parsed.data.FRONTEND_URL,
  databaseUrl: parsed.data.DATABASE_URL,
  redisUrl: parsed.data.REDIS_URL,
  redisPassword: parsed.data.REDIS_PASSWORD,
  elasticsearchUrl: parsed.data.ELASTICSEARCH_URL,
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
  },
  google: {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    callbackUrl: parsed.data.GOOGLE_CALLBACK_URL,
  },
  slack: {
    clientId: parsed.data.SLACK_CLIENT_ID,
    clientSecret: parsed.data.SLACK_CLIENT_SECRET,
    redirectUri: parsed.data.SLACK_REDIRECT_URI,
  },
  ethereal: {
    host: parsed.data.ETHEREAL_HOST,
    port: parseInt(parsed.data.ETHEREAL_PORT),
    user: parsed.data.ETHEREAL_USER,
    password: parsed.data.ETHEREAL_PASSWORD,
    fromName: parsed.data.ETHEREAL_FROM_NAME,
  },
  worker: {
    concurrency: parseInt(parsed.data.WORKER_CONCURRENCY),
    minEmailDelayMs: parseInt(parsed.data.MIN_EMAIL_DELAY_MS),
    maxEmailsPerHour: parseInt(parsed.data.MAX_EMAILS_PER_HOUR),
  },
  admin: {
    username: parsed.data.ADMIN_USERNAME,
    password: parsed.data.ADMIN_PASSWORD,
  },
};

export type Env = typeof env;
