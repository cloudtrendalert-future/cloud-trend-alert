import { followVerifyCard } from '../../../cards/system/followVerifyCard.js';
import { getUserPlan } from '../../../policy/plans.js';

export function requireFollowVerify({ env, userRepo }) {
  return async (ctx, next) => {
    if (ctx.chat?.type !== 'private') {
      return next();
    }

    const userId = Number(ctx.from?.id);
    const user = await getUserPlan({ env, userRepo }, userId);

    if (user.plan === 'premium') {
      return next();
    }

    if (user.followVerified) {
      return next();
    }

    const card = followVerifyCard(env.requiredChannelUsername);
    await ctx.reply(card.text, {
      ...(card.buttons ? { reply_markup: { inline_keyboard: card.buttons } } : {})
    });
  };
}
