import { quotaCard } from '../../../cards/system/quotaCard.js';
import { checkAndConsumeFreeScanQuota } from '../../../policy/quotaPolicy.js';
import { getUserPlan } from '../../../policy/plans.js';

export function quotaGuard({ env, userRepo, quotaRepo }) {
  return async (ctx, next) => {
    if (ctx.chat?.type !== 'private') {
      return next();
    }

    const userId = Number(ctx.from?.id);
    const user = await getUserPlan({ env, userRepo }, userId);

    if (user.plan === 'premium') {
      return next();
    }

    const check = await checkAndConsumeFreeScanQuota({ quotaRepo, env }, userId, 'scan');
    if (check.ok) {
      ctx.state.quota = check;
      return next();
    }

    const card = quotaCard(check);
    await ctx.reply(card.text);
  };
}
