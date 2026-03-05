import { followVerifyCard } from '../../../cards/system/followVerifyCard.js';
import { getUserPlan, isPremiumUser } from '../../../policy/plans.js';

function isMemberStatus(status) {
  return ['member', 'administrator', 'creator'].includes(status);
}

export function registerCallbackRouter(bot, deps) {
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery?.data || '';

    if (data === 'nav:close') {
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      return ctx.answerCbQuery();
    }

    if (data === 'free:verify') {
      const userId = Number(ctx.from.id);
      try {
        const member = await ctx.telegram.getChatMember(deps.env.requiredChannelId, userId);
        const ok = isMemberStatus(member.status);
        if (ok) {
          await deps.userRepo.setFollowVerified(userId, true);
          await ctx.answerCbQuery('Verification successful.');
          await ctx.reply('Verification successful. You can now use /scan.');
        } else {
          await ctx.answerCbQuery('You are not a channel member yet.', { show_alert: true });
          const card = followVerifyCard(deps.env.requiredChannelUsername);
          await ctx.reply(card.text, {
            reply_markup: { inline_keyboard: card.buttons }
          });
        }
      } catch {
        await ctx.answerCbQuery('Verification failed. Try again.', { show_alert: true });
      }
      return;
    }

    if (data.startsWith('wizard:')) {
      const handled = await deps.wizardCore.handleCallback(ctx, data);
      if (!handled) {
        await ctx.answerCbQuery();
      }
      return;
    }

    if (data === 'closed:today') {
      await deps.commands.statusClosed(ctx, null);
      return ctx.answerCbQuery();
    }

    if (data === 'closed:yesterday') {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await deps.commands.statusClosed(ctx, yesterday);
      return ctx.answerCbQuery();
    }

    if (data.startsWith('closed:prev:')) {
      const day = data.split(':')[2];
      const date = new Date(`${day}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      await deps.commands.statusClosed(ctx, date.toISOString().slice(0, 10));
      return ctx.answerCbQuery();
    }

    if (data.startsWith('closed:next:')) {
      const day = data.split(':')[2];
      const date = new Date(`${day}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      await deps.commands.statusClosed(ctx, date.toISOString().slice(0, 10));
      return ctx.answerCbQuery();
    }

    if (data === 'closed:pick') {
      await deps.commands.pickDateWizard.start(ctx, 'statusclosed');
      return ctx.answerCbQuery();
    }

    if (data === 'menu:signal') {
      await ctx.reply('Use /scan to generate a signal.');
      return ctx.answerCbQuery();
    }

    if (data === 'menu:status') {
      await ctx.reply('Use /status to open dashboard.');
      return ctx.answerCbQuery();
    }

    if (data === 'menu:cohort') {
      await ctx.reply('Use /cohort for 7D or /cohort DD-MM-YYYY for rolling 30D.');
      return ctx.answerCbQuery();
    }

    if (data === 'menu:info') {
      await ctx.reply('Use /info for yesterday recap.');
      return ctx.answerCbQuery();
    }

    if (data === 'menu:profit') {
      const user = await getUserPlan({ env: deps.env, userRepo: deps.userRepo }, Number(ctx.from.id));
      if (!isPremiumUser(deps.env, user)) {
        await ctx.answerCbQuery('Premium required.', { show_alert: true });
        return;
      }
      await deps.commands.profit(ctx);
      return ctx.answerCbQuery();
    }

    if (data.startsWith('nav:')) {
      return ctx.answerCbQuery('Use slash command to refresh this card.');
    }

    return ctx.answerCbQuery();
  });
}
