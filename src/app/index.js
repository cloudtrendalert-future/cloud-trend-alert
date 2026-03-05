import { bootstrapApp } from './bootstrap.js';

async function main() {
  const app = await bootstrapApp();
  await app.start();

  const shutdown = async (signal) => {
    console.log(`[app] received ${signal}, shutting down`);
    await app.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  console.log('[app] started');
}

main().catch((error) => {
  console.error('[app] fatal', error);
  process.exit(1);
});
