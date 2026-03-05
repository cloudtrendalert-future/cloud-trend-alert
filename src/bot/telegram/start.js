import { freeReplyMenu, premiumReplyMenu } from './ui/replyMenu.js';
import { premiumHomeInline, freeInline } from './ui/inlineMenus.js';
import { getUserPlan, isPremiumUser } from '../../policy/plans.js';

export function registerStartCommand(bot, deps) {
  bot.start(async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Group mode is slash-only.');
      return;
    }

    const user = await getUserPlan({ env: deps.env, userRepo: deps.userRepo }, Number(ctx.from.id));
    const premium = isPremiumUser(deps.env, user);

    if (premium) {
      await ctx.reply('Premium menu loaded.', premiumReplyMenu());
      await ctx.reply('Quick actions:', { reply_markup: { inline_keyboard: premiumHomeInline() } });
      return;
    }

    await ctx.reply('Free menu loaded. Follow + verify required before /scan.', freeReplyMenu());
    await ctx.reply('Quick actions:', { reply_markup: { inline_keyboard: freeInline() } });
  });
}
