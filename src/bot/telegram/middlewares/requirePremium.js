import { premiumRequiredCard } from '../../../cards/system/premiumRequiredCard.js';
import { getUserPlan, isPremiumUser } from '../../../policy/plans.js';

export function requirePremium({ env, userRepo }) {
  return async (ctx, next) => {
    if (ctx.chat?.type !== 'private') {
      return next();
    }

    const userId = Number(ctx.from?.id);
    const user = await getUserPlan({ env, userRepo }, userId);

    if (isPremiumUser(env, user)) {
      return next();
    }

    const card = premiumRequiredCard();
    await ctx.reply(card.text);
  };
}
