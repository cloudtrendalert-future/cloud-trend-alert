import { manualTop3Card } from '../../../cards/signals/manualTop3Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';

export function createScanCommand({ manualRunner, tradeMonitor, env }) {
  return async (ctx) => {
    const result = await manualRunner.run();

    if (!result.top3.length) {
      const card = noSetupCard(result.noSetupReasons);
      await ctx.reply(card.text);
      return;
    }

    const card = manualTop3Card(result.top3, {
      asOfUtc: new Date().toISOString(),
      threshold: env.manualScoreThreshold
    });

    await ctx.reply(card.text);

    if (ctx.state.enablePerformance) {
      for (const candidate of result.top3) {
        await tradeMonitor.onSignalIssued(candidate);
      }
    }
  };
}
