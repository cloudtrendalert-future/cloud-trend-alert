import { cooldownCard } from '../../../cards/system/cooldownCard.js';
import { checkAndTouchCooldown } from '../../../policy/cooldownPolicy.js';

export function cooldownGuard({ cooldownRepo }, action, cooldownSeconds) {
  return async (ctx, next) => {
    const userId = Number(ctx.from?.id || 0);
    const scopeKey = `user:${userId}`;

    const check = await checkAndTouchCooldown({ cooldownRepo }, scopeKey, action, cooldownSeconds);

    if (check.ok) {
      return next();
    }

    const card = cooldownCard({
      action,
      remainingSeconds: check.remainingSeconds
    });

    await ctx.reply(card.text);
  };
}
