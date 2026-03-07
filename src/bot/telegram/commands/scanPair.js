import { pairTop1Card } from '../../../cards/signals/pairTop1Card.js';
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

export function createScanPairCommand({ manualRunner, tradeMonitor, logger = console }) {
  return async (ctx, pairRaw) => {
    const { isGroup, chatId, userId, groupTitle } = getContext(ctx);
    const pair = normalizePair(pairRaw || '');
    const prefix = isGroup ? '[group]' : '[premium]';

    if (isGroup) {
      logger.info?.(`${prefix} command=/scan pair chat=${chatId} group="${groupTitle}" user=${userId} pair=${pair || 'invalid'}`);
    } else {
      logger.info?.(`${prefix} command=/scan pair chat=${chatId} user=${userId} pair=${pair || 'invalid'}`);
    }

    if (!pair || !pair.endsWith('USDT')) {
      await ctx.reply('Usage: /scan BTCUSDT');
      logger.info?.(`${prefix} command=/scan pair invalid pair=${pair || 'empty'}`);
      return;
    }

    try {
      const result = await manualRunner.run({ pair });
      const top = result.top3[0] || null;

      if (!top) {
        const card = noSetupCard(result.noSetupReasons);
        await ctx.reply(card.text);
        logger.info?.(`${prefix} command=/scan pair no setup pair=${pair}`);
        return;
      }

      const card = pairTop1Card(top, pair);
      await ctx.reply(card.text);
      logger.info?.(`${prefix} command=/scan pair success pair=${pair}`);

      if (ctx.state.enablePerformance) {
        await tradeMonitor.onSignalIssued(top);
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      logger.error?.(`${prefix} command=/scan pair failed pair=${pair || 'invalid'} error=${errorMessage}`);
      throw error;
    }
  };
}
