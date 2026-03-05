import { statusCard } from '../../../cards/stats/statusCard.js';
import { todayUtc } from './dateUtils.js';

function maybeReplyMarkup(ctx, card) {
  if (ctx.chat?.type !== 'private' || !card.buttons?.length) {
    return {};
  }

  return { reply_markup: { inline_keyboard: card.buttons } };
}

export function createStatusCommand({ dailyAggregator }) {
  return async (ctx) => {
    const dayUtc = todayUtc();
    const summary = await dailyAggregator.rangeSummary(dayUtc, dayUtc);
    const card = statusCard({ dayUtc, summary });
    await ctx.reply(card.text, maybeReplyMarkup(ctx, card));
  };
}
