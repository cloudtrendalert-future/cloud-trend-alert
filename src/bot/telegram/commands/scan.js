import { manualTop3Card } from '../../../cards/signals/manualTop3Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';
import { isRenderableSignalCandidate } from '../../../cards/signals/signalCard.js';

export function createScanCommand({ manualRunner, tradeMonitor, env }) {
  return async (ctx) => {
    const result = await manualRunner.run();
    const validCandidates = result.top3.filter((candidate) => isRenderableSignalCandidate(candidate));

    const cards = manualTop3Card(validCandidates, {
      asOfUtc: new Date().toISOString(),
      threshold: env.manualScoreThreshold
    });

    if (!cards.length) {
      const reasons = result.noSetupReasons.length
        ? result.noSetupReasons
        : ['No valid signal payload was produced for this scan.'];
      const card = noSetupCard(reasons);
      await ctx.reply(card.text);
      return;
    }

    for (const card of cards) {
      await ctx.reply(card.text);
    }

    if (ctx.state.enablePerformance) {
      for (const candidate of validCandidates) {
        await tradeMonitor.onSignalIssued(candidate);
      }
    }
  };
}
