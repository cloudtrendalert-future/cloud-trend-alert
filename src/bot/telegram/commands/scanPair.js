import { pairTop1Card } from '../../../cards/signals/pairTop1Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';

function normalizePair(pair) {
  return pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createScanPairCommand({ manualRunner, tradeMonitor }) {
  return async (ctx, pairRaw) => {
    const pair = normalizePair(pairRaw || '');
    if (!pair || !pair.endsWith('USDT')) {
      await ctx.reply('Usage: /scan BTCUSDT');
      return;
    }

    const result = await manualRunner.run({ pair });
    const top = result.top3[0] || null;

    if (!top) {
      const card = noSetupCard(result.noSetupReasons);
      await ctx.reply(card.text);
      return;
    }

    const card = pairTop1Card(top, pair);
    await ctx.reply(card.text);

    if (ctx.state.enablePerformance) {
      await tradeMonitor.onSignalIssued(top);
    }
  };
}
