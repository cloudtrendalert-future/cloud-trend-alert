import { statusOpenCard } from '../../../cards/stats/statusOpenCard.js';

function maybeReplyMarkup(ctx, card) {
  if (ctx.chat?.type !== 'private' || !card.buttons?.length) {
    return {};
  }

  return { reply_markup: { inline_keyboard: card.buttons } };
}

export function createStatusOpenCommand({ tradeRepo }) {
  return async (ctx) => {
    const openTrades = await tradeRepo.listOpen();
    const card = statusOpenCard(openTrades);
    await ctx.reply(card.text, maybeReplyMarkup(ctx, card));
  };
}
