# ON8 — Email Job Scheduler & Campaign Dashboard

A production-quality full-stack email scheduling platform built as a placement assignment for **Outbox Labs / ReachInbox**. Schedule one-off or bulk email campaigns with precise rate limiting, real-time status tracking, and a beautiful dashboard UI.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features Implemented](#features-implemented)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone & Install](#1-clone--install)
  - [2. Start Infrastructure (Docker)](#2-start-infrastructure-docker)
  - [3. Set Up Environment Variables](#3-set-up-environment-variables)
  - [4. Set Up Ethereal Email](#4-set-up-ethereal-email)
  - [5. Run Database Migrations](#5-run-database-migrations)
  - [6. Run the Backend](#6-run-the-backend)
  - [7. Run the Frontend](#7-run-the-frontend)
  - [8. Run Both Together](#8-run-both-together)
- [Environment Variable Reference](#environment-variable-reference)
- [Admin & Monitoring](#admin--monitoring)
- [Project Structure](#project-structure)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Vanilla CSS |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | PostgreSQL 15 via Prisma ORM |
| **Queue** | BullMQ (Redis-backed job queue) |
| **Cache / Rate Limiting** | Redis (ioredis) |
| **Search** | Elasticsearch 8 |
| **Email** | Nodemailer + Ethereal SMTP (test) |
| **Auth** | Google OAuth 2.0 + JWT (httpOnly cookies) |
| **Notifications** | Slack Web API |
| **Infrastructure** | Docker Compose |
| **Queue Dashboard** | Bull Board (/admin/queues) |

---

## Features Implemented

### Backend

| Feature | Details |
|---|---|
| **Email Scheduling** | Per-email BullMQ delayed jobs; each recipient gets its own job with precise scheduledAt computed from startTime + index x delay |
| **Immediate Send** | startTime = now dispatches jobs with ~0ms delay via BullMQ |
| **Bulk Campaign** | Upload a CSV of recipients; each is individually scheduled, tracked, and retried independently |
| **Persistence on Restart** | All jobs are stored in Redis (BullMQ) AND in PostgreSQL. On server restart, the worker reconnects and resumes processing any pending SCHEDULED jobs without data loss |
| **Rate Limiting — Hourly** | Redis INCR atomic counter per sender per hour; hourlyLimit = 0 means unlimited |
| **Rate Limiting — Inter-email Delay** | Redis SET NX PX lock per sender enforces minimum milliseconds between sends; delay = 0 bypasses the lock entirely |
| **Concurrency** | BullMQ worker runs with configurable concurrency (default 5); atomic DB transaction (SCHEDULED to PROCESSING) prevents duplicate sends across concurrent workers |
| **Idempotent Jobs** | Each BullMQ job has a deterministic ID (email_{emailId}); re-adding the same job is a no-op |
| **Retry with Backoff** | Failed sends retry up to 3 times with exponential backoff: 5s, 25s, 125s |
| **Email Status Tracking** | Full state machine: SCHEDULED -> PROCESSING -> SENT / FAILED / RATE_LIMITED |
| **Elasticsearch Indexing** | Every email is indexed on create and status update for fast full-text search |
| **Slack Notifications** | Sends a Slack alert (once per sender per hour) when an hourly rate limit is hit |
| **Google OAuth Login** | Google Sign-In flow; issues JWT stored in httpOnly cookie |
| **Sender Management** | Users can configure multiple sender identities (name + email) |
| **Bull Board** | Real-time queue monitor at http://localhost:3001/admin/queues (Basic Auth protected) |
| **Input Validation** | express-validator on all API routes; strict Zod schema for env vars at startup |
| **Security** | Helmet, CORS, rate limiter middleware, httpOnly JWT cookies |

### Frontend

| Feature | Details |
|---|---|
| **Login Screen** | Google OAuth button with branded ON8 design |
| **Sidebar Navigation** | Logo, user avatar + email, Compose, Scheduled, Sent, Slack integration link |
| **Compose Screen** | Rich text editor (toolbar: bold, italic, underline, strike, lists, alignment); To field with tag-style multi-recipient input; CSV upload for bulk recipients; Delay and Hourly Limit fields; Send Now / Send Later toggle |
| **Scheduled Table** | Paginated list of pending emails with recipient, subject, sender, scheduled time, status badge |
| **Sent Table** | Paginated list of delivered emails with sent time, preview link (Ethereal), message ID |
| **Email Detail View** | Full email card showing recipient, sender, schedule time, attempt count, error message (if any), and rendered body |
| **Real-time Status Poll** | Scheduled and Sent pages auto-refresh every 10 seconds |
| **Empty States** | Illustrated empty states for Scheduled and Sent views |
| **Loading States** | Skeleton loaders and spinner indicators |
| **Responsive Layout** | Sidebar collapses gracefully on narrow viewports |
| **User Profile Dropdown** | Shows name, email; Logout option |
| **Slack Connect** | Sidebar shows Connect link for Slack OAuth integration |

---

## Architecture Overview

### How Scheduling Works

```
User clicks "Send Now" or "Send Later"
        |
        v
POST /api/campaigns
        |
        +-- Validate recipients (deduplicate, check email format)
        +-- Create EmailCampaign row in PostgreSQL
        +-- For each recipient:
        |     scheduledAt = startTime + (index x delayBetweenEmails)
        |     Create Email row (status = SCHEDULED)
        |     addEmailJob(emailId, scheduledAt)  --> BullMQ delayed job
        |
        v
BullMQ Worker picks up job when delay elapses
        |
        +-- Atomic DB transition: SCHEDULED -> PROCESSING
        +-- Check hourly rate limit (Redis INCR)
        |     +-- If exceeded: reschedule to next hour, send Slack alert
        +-- Acquire inter-email delay slot (Redis SET NX)
        |     +-- If slot busy: requeue with short delay
        +-- Send email via Nodemailer (Ethereal SMTP)
        +-- Update DB: status = SENT, sentAt, providerMessageId
        +-- Update Elasticsearch index
        +-- Check if campaign is fully complete
```

### How Persistence on Restart is Handled

BullMQ stores all jobs durably in **Redis**. PostgreSQL stores every email record with its `status`. On server restart:

1. The BullMQ worker reconnects to Redis and **automatically resumes** processing any `delayed` or `waiting` jobs — no manual recovery needed.
2. Because job IDs are deterministic (`email_{emailId}`), re-adding the same job after a restart is idempotent — BullMQ ignores duplicates.
3. Redis is configured with `appendonly yes` in Docker Compose, ensuring the BullMQ queue state survives a Redis restart.

> **No emails are lost on restart.** All state is double-persisted in both Redis (queue) and PostgreSQL (records).

### How Rate Limiting & Concurrency are Implemented

#### Per-sender Hourly Cap

```
Redis key:  rl:sender:<senderId>:<YYYY-MM-DD-HH>
Operation:  INCR (atomic — safe across multiple workers)
TTL:        set on first increment, expires at end of hour + 1hr buffer

If limit > 0 AND count > limit:
  -> reschedule email to start of next hour
  -> send one Slack notification per sender per hour (idempotent)

If limit = 0:
  -> no cap applied; all emails pass through immediately
```

#### Inter-email Minimum Delay

```
Redis key:  delay:sender:<senderId>
Operation:  SET key "1" PX <delayMs> NX  (auto-expires after delay window)

If SET returns OK  -> slot acquired, proceed to send
If SET returns nil -> slot busy, requeue with (delay + 500ms)

If delayMs = 0    -> skip lock entirely (instant send, no Redis round-trip)
```

#### Worker Concurrency

```
BullMQ Worker concurrency = 5 (configurable via WORKER_CONCURRENCY env var)

Race condition prevention:
  PostgreSQL transaction atomically transitions SCHEDULED -> PROCESSING
  If two workers race for the same email, only one succeeds —
  the other sees status = PROCESSING and exits cleanly (no duplicate send)
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18 (recommend [nvm](https://github.com/nvm-sh/nvm))
- **Docker** + **Docker Compose** (for Postgres, Redis, Elasticsearch)
- A **Google Cloud** project with OAuth 2.0 credentials
- An **Ethereal Email** account (free — no real emails are sent)
- *(Optional)* A **Slack App** for rate-limit notifications

---

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd email-scheduler
npm install
```

This installs dependencies for the root, backend, and frontend workspaces.

---

### 2. Start Infrastructure (Docker)

```bash
npm run docker:up
```

This starts:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379` (with `appendonly yes` for durability)
- **Elasticsearch** on port `9200`

Wait ~30 seconds for Elasticsearch to become healthy before starting the backend.

To stop all containers:

```bash
npm run docker:down
```

---

### 3. Set Up Environment Variables

Create `backend/.env`:

```bash
cp backend/.env.example backend/.env   # if .env.example exists
# OR create it manually — see the full reference below
```

At minimum, you must set:
- `DATABASE_URL`
- `JWT_SECRET` (min 32 characters)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `ETHEREAL_USER` and `ETHEREAL_PASSWORD`

---

### 4. Set Up Ethereal Email

Ethereal is a free fake SMTP service — emails are captured and visible in a web inbox but **never actually delivered**. This is ideal for development and testing.

**Auto-generate credentials (recommended):**

```bash
cd backend
node -e "
const nodemailer = require('nodemailer');
nodemailer.createTestAccount().then(a => {
  console.log('ETHEREAL_USER=' + a.user);
  console.log('ETHEREAL_PASSWORD=' + a.pass);
});
"
```

Copy the two lines of output into `backend/.env`.

**Manual setup:**

1. Visit [https://ethereal.email](https://ethereal.email)
2. Click **"Create Ethereal Account"**
3. Copy the **SMTP Username** and **Password** into your `.env`

**View captured emails:**  
Go to [https://ethereal.email/messages](https://ethereal.email/messages) and log in with the same credentials.

---

### 5. Run Database Migrations

```bash
# From the project root:
npm run db:migrate

# Or directly:
cd backend && npx prisma migrate dev
```

To open the Prisma database GUI:

```bash
npm run db:studio
```

---

### 6. Run the Backend

```bash
cd backend
npm run dev
```

This starts:
- **Express API server** at `http://localhost:3001`
- **BullMQ email worker** in the same process (auto-starts)
- **Bull Board** at `http://localhost:3001/admin/queues`

The backend uses `ts-node-dev` with `--respawn`, so it hot-reloads on `.ts` file changes.

> **Note:** After editing `.env`, you must restart the backend manually — `ts-node-dev` only watches `.ts` files, not environment files.

---

### 7. Run the Frontend

```bash
cd frontend
npm run dev
```

The frontend starts at **http://localhost:3000**

Create `frontend/.env.local` if it doesn't exist:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### 8. Run Both Together

From the project root:

```bash
npm run dev
```

Uses `concurrently` to start both backend and frontend in a single terminal.

---

## Environment Variable Reference

### `backend/.env`

```env
# ── Server ──────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── Database (PostgreSQL) ────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_scheduler

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://:redis@localhost:6379
REDIS_PASSWORD=redis

# ── Elasticsearch ────────────────────────────────────────────────
ELASTICSEARCH_URL=http://localhost:9200

# ── JWT ──────────────────────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars-long
JWT_EXPIRES_IN=7d

# ── Google OAuth ─────────────────────────────────────────────────
# Setup: https://console.cloud.google.com/apis/credentials
# Add Authorized Redirect URI: http://localhost:3001/api/auth/google/callback
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# ── Slack OAuth (optional) ────────────────────────────────────────
# Setup: https://api.slack.com/apps
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3001/api/slack/callback

# ── Ethereal Email (SMTP for testing) ────────────────────────────
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=your-generated-user@ethereal.email
ETHEREAL_PASSWORD=your-generated-password
ETHEREAL_FROM_NAME=ON8 Email Scheduler

# ── Worker Configuration ──────────────────────────────────────────
WORKER_CONCURRENCY=5       # number of parallel email sends
MIN_EMAIL_DELAY_MS=2000    # global minimum ms between sends per sender (0 = instant)
MAX_EMAILS_PER_HOUR=200    # global default hourly cap

# ── Bull Board Admin ──────────────────────────────────────────────
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Admin & Monitoring

| URL | Description | Auth |
|---|---|---|
| `http://localhost:3000` | Frontend dashboard | Google OAuth |
| `http://localhost:3001/admin/queues` | Bull Board — real-time BullMQ queue monitor | Basic Auth (ADMIN_USERNAME / ADMIN_PASSWORD) |
| `http://localhost:3001/health` | Backend health check (JSON) | None |
| `https://ethereal.email/messages` | View all captured test emails | Ethereal credentials |

---

## Project Structure

```
email-scheduler/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # DB schema (User, Sender, EmailCampaign, Email, SlackConnection)
│   │   └── migrations/            # Prisma migration history
│   └── src/
│       ├── config/                # env.ts, redis.ts, prisma.ts
│       ├── controllers/           # Route handler functions
│       ├── integrations/
│       │   ├── email/             # Nodemailer + Ethereal provider
│       │   ├── elasticsearch/     # Email indexing + search
│       │   └── slack/             # Slack OAuth + notifications
│       ├── middleware/            # auth, validation, error, rate-limit
│       ├── queues/
│       │   └── emailQueue.ts      # addEmailJob, removeEmailJob, Bull Board setup
│       ├── repositories/          # Prisma data access layer
│       ├── routes/                # Express routers (auth, campaigns, emails, slack)
│       ├── services/
│       │   └── campaign.service.ts  # Business logic: schedule + bulk create
│       ├── utils/
│       │   ├── rateLimiter.ts     # Redis-based hourly cap + delay slot
│       │   └── csvParser.ts       # Recipient list validation + dedup
│       ├── workers/
│       │   └── emailWorker.ts     # BullMQ worker: process, rate-limit, send, retry
│       └── server.ts              # Express app + worker bootstrap
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── login/             # Google OAuth login page
│       │   └── dashboard/
│       │       ├── compose/       # Compose new email campaign
│       │       ├── scheduled/     # Scheduled emails table
│       │       ├── sent/          # Sent emails table
│       │       └── email/[id]/    # Email detail view
│       ├── components/            # Sidebar, Header, EmailTable, ComposeForm, etc.
│       └── lib/                   # API client, auth utilities
├── docker-compose.yml             # PostgreSQL + Redis + Elasticsearch
└── package.json                   # Root workspace: dev, docker:up, db:migrate scripts
```
