import 'dotenv/config';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { getRedisClient, disconnectRedis } from './config/redis';
import { initializeElasticsearch } from './config/elasticsearch';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';
import { closeQueue } from './queues/emailQueue';

async function bootstrap(): Promise<void> {
  console.log('\n🚀 Starting Email Scheduler Server...\n');

  // Initialize connections
  await connectDatabase();
  getRedisClient(); // Initialize Redis connection
  await initializeElasticsearch();

  // Start BullMQ worker in same process (can be separated for scaling)
  startEmailWorker();

  // Start HTTP server
  const server = app.listen(env.port, () => {
    console.log(`\n✅ Server running on http://localhost:${env.port}`);
    console.log(`📋 Bull Board: http://localhost:${env.port}/admin/queues`);
    console.log(`🔍 Health: http://localhost:${env.port}/health`);
    console.log(`🌍 Environment: ${env.nodeEnv}\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      await stopEmailWorker();
      await closeQueue();
      await disconnectDatabase();
      await disconnectRedis();
      console.log('✅ Server shut down gracefully');
      process.exit(0);
    });

    // Force kill after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
