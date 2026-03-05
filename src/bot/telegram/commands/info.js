import { dailyRecapCard } from '../../../cards/stats/dailyRecapCard.js';
import { todayUtc, shiftDay } from './dateUtils.js';

function maybeReplyMarkup(ctx, card) {
  if (ctx.chat?.type !== 'private' || !card.buttons?.length) {
    return {};
  }

  return { reply_markup: { inline_keyboard: card.buttons } };
}

export function createInfoCommand({ dailyAggregator }) {
  return async (ctx) => {
    const dayUtc = shiftDay(todayUtc(), -1);
    const summary = await dailyAggregator.rangeSummary(dayUtc, dayUtc);
    const card = dailyRecapCard({ dayUtc, summary });
    await ctx.reply(card.text, maybeReplyMarkup(ctx, card));
  };
}
