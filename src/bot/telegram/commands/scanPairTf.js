import { TIMEFRAMES } from '../../../config/constants.js';
import { pairTfTop1Card } from '../../../cards/signals/pairTfTop1Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';

function normalizePair(pair) {
  return pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getContext(ctx) {
  const isGroup = ctx.chat?.type !== 'private';
  return {
    isGroup,
    chatId: Number(ctx.chat?.id || 0),
    userId: Number(ctx.from?.id || 0),
    groupTitle: String(ctx.chat?.title || '').replaceAll('"', '\'')
  };
}

export function createScanPairTfCommand({ manualRunner, tradeMonitor, logger = console }) {
  return async (ctx, pairRaw, tfRaw) => {
    const { isGroup, chatId, userId, groupTitle } = getContext(ctx);
    const pair = normalizePair(pairRaw || '');
    const timeframe = (tfRaw || '').toLowerCase();
    const prefix = isGroup ? '[group]' : '[premium]';

    if (isGroup) {
      logger.info?.(
        `${prefix} command=/scan pair tf chat=${chatId} group="${groupTitle}" user=${userId} pair=${pair || 'invalid'} tf=${timeframe || 'invalid'}`
      );
    } else {
      logger.info?.(
        `${prefix} command=/scan pair tf chat=${chatId} user=${userId} pair=${pair || 'invalid'} tf=${timeframe || 'invalid'}`
      );
    }

    if (!pair || !pair.endsWith('USDT') || !TIMEFRAMES.includes(timeframe)) {
      await ctx.reply('Usage: /scan BTCUSDT 30m|1h|4h');
      logger.info?.(`${prefix} command=/scan pair tf invalid pair=${pair || 'empty'} tf=${timeframe || 'empty'}`);
      return;
    }

    try {
      const result = await manualRunner.run({ pair, timeframe });
      const top = result.top3[0] || null;

      if (!top) {
        const card = noSetupCard(result.noSetupReasons);
        await ctx.reply(card.text);
        logger.info?.(`${prefix} command=/scan pair tf no setup pair=${pair} tf=${timeframe}`);
        return;
      }

      const card = pairTfTop1Card(top, pair, timeframe);
      await ctx.reply(card.text);
      logger.info?.(`${prefix} command=/scan pair tf success pair=${pair} tf=${timeframe}`);

      if (ctx.state.enablePerformance) {
        await tradeMonitor.onSignalIssued(top);
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      logger.error?.(`${prefix} command=/scan pair tf failed pair=${pair || 'invalid'} tf=${timeframe || 'invalid'} error=${errorMessage}`);
      throw error;
    }
  };
}
