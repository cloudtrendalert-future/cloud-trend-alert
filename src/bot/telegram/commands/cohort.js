import { cohort7dCard } from '../../../cards/stats/cohort7dCard.js';
import { cohort30dCard } from '../../../cards/stats/cohort30dCard.js';
import { renderCard, section } from '../../../cards/base/layout.js';
import { parseDdMmYyyy, todayUtc, shiftDay, isWithinRetention } from './dateUtils.js';

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

export function createCohortCommand({ env, dailyAggregator }) {
  return async (ctx, argRaw = null) => {
    if (!argRaw) {
      const endDayUtc = todayUtc();
      const startDayUtc = shiftDay(endDayUtc, -6);
      const summary = await dailyAggregator.rangeSummary(startDayUtc, endDayUtc);
      const card = cohort7dCard({ startDayUtc, endDayUtc, summary });
      await ctx.reply(card.text, maybeReplyMarkup(ctx, card));
      return;
    }

    const endDayUtc = parseDdMmYyyy(argRaw);
    if (!endDayUtc) {
      await ctx.reply('Use /cohort DD-MM-YYYY');
      return;
    }

    if (!isWithinRetention(endDayUtc, env.retentionDays)) {
      const card = outOfRangeCard(env.retentionDays);
      await ctx.reply(card.text);
      return;
    }

    const startDayUtc = shiftDay(endDayUtc, -29);
    const summary = await dailyAggregator.rangeSummary(startDayUtc, endDayUtc);
    const card = cohort30dCard({ startDayUtc, endDayUtc, summary });
    await ctx.reply(card.text, maybeReplyMarkup(ctx, card));
  };
}
