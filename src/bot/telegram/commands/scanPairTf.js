import { TIMEFRAMES } from '../../../config/constants.js';
import { pairTfTop1Card } from '../../../cards/signals/pairTfTop1Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';

function normalizePair(pair) {
  return pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createScanPairTfCommand({ manualRunner, tradeMonitor }) {
  return async (ctx, pairRaw, tfRaw) => {
    const pair = normalizePair(pairRaw || '');
    const timeframe = (tfRaw || '').toLowerCase();

    if (!pair || !pair.endsWith('USDT') || !TIMEFRAMES.includes(timeframe)) {
      await ctx.reply('Usage: /scan BTCUSDT 30m|1h|4h');
      return;
    }

    const result = await manualRunner.run({ pair, timeframe });
    const top = result.top3[0] || null;

    if (!top) {
      const card = noSetupCard(result.noSetupReasons);
      await ctx.reply(card.text);
      return;
    }

    const card = pairTfTop1Card(top, pair, timeframe);
    await ctx.reply(card.text);

    if (ctx.state.enablePerformance) {
      await tradeMonitor.onSignalIssued(top);
    }
  };
}
