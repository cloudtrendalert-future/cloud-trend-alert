import { validateEnv } from '../src/config/env.js';
import { bootstrapApp } from '../src/app/bootstrap.js';

async function run() {
  const validation = validateEnv();
  if (!validation.ok) {
    console.error('Env validation failed:');
    validation.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const app = await bootstrapApp({ dryRun: true });
  console.log('Dry-run bootstrap OK. Loaded modules:');
  console.log(`- adapters: ${app.services.klinesService.adapters.length}`);
  console.log(`- strategies: ${app.services.manualRunner.strategies.length}`);

  try {
    const merged = await app.services.universeProvider.fetchMergedTop100();
    console.log(`Universe dry-run fetched: ${merged.length} symbols`);
  } catch (error) {
    console.warn(`Universe dry-run fetch failed (non-fatal): ${error.message}`);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Sanity check failed:', error);
  process.exit(1);
});
