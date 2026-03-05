import { statusClosedCard } from '../../../cards/stats/statusClosedCard.js';
import { renderCard, section } from '../../../cards/base/layout.js';
import { summarizeOutcomes } from '../../../performance/outcomeBuckets.js';
import { parseDdMmYyyy, todayUtc, shiftDay, isWithinRetention, formatDdMmYyyy } from './dateUtils.js';

function maybeReplyMarkup(ctx, card) {
  if (ctx.chat?.type !== 'private' || !card.buttons?.length) {
    return {};
  }

  return { reply_markup: { inline_keyboard: card.buttons } };
}

function outOfRangeCard(retentionDays) {
  return {
    text: renderCard({
      title: 'Date Out Of Range',
      sections: [
        section('RANGE', [`Pick date within last ${retentionDays} UTC days.`])
      ]
    })
  };
}

function buildDateButtons(dayUtc) {
  return [
    [
      { text: 'Today', callback_data: 'closed:today' },
      { text: 'Yesterday', callback_data: 'closed:yesterday' }
    ],
    [
      { text: 'Prev', callback_data: `closed:prev:${dayUtc}` },
      { text: 'Next', callback_data: `closed:next:${dayUtc}` }
    ],
    [{ text: 'Pick Date', callback_data: 'closed:pick' }]
  ];
}

export function createStatusClosedCommand({ env, tradeRepo }) {
  return async (ctx, argRaw = null) => {
    let dayUtc = todayUtc();

    if (argRaw) {
      const parsed = parseDdMmYyyy(argRaw) || (argRaw.match(/^\d{4}-\d{2}-\d{2}$/) ? argRaw : null);
      if (!parsed) {
        await ctx.reply('Use /statusclosed DD-MM-YYYY');
        return;
      }
      dayUtc = parsed;
    }

    if (!isWithinRetention(dayUtc, env.retentionDays)) {
      const card = outOfRangeCard(env.retentionDays);
      await ctx.reply(card.text);
      return;
    }

    const closedTrades = await tradeRepo.listClosedByDay(dayUtc);
    const summary = summarizeOutcomes(closedTrades);
    const card = statusClosedCard({ dayUtc, closedTrades, summary });

    if (ctx.chat?.type === 'private') {
      card.buttons = [...buildDateButtons(dayUtc), ...(card.buttons || [])];
    }

    await ctx.reply(card.text, maybeReplyMarkup(ctx, card));

    if (ctx.chat?.type === 'private') {
      await ctx.reply(`Tip: /statusclosed ${formatDdMmYyyy(shiftDay(dayUtc, -1))} for another day.`);
    }
  };
}
