import { ensureGroupAllowance } from '../../../policy/groupPolicy.js';
import { groupNotAllowedCard } from '../../../cards/system/groupNotAllowedCard.js';

export function requireGroupAllowed({ env, groupRepo }) {
  return async (ctx, next) => {
    if (ctx.chat?.type === 'private') {
      return next();
    }

    const groupId = Number(ctx.chat?.id);
    const title = ctx.chat?.title || '';
    const result = await ensureGroupAllowance({ env, groupRepo }, groupId, title);

    if (result.allowed) {
      return next();
    }

    try {
      const card = groupNotAllowedCard();
      await ctx.reply(card.text);
    } catch {
      // ignore send failures
    }

    try {
      await ctx.leaveChat();
    } catch {
      // ignore leave failures
    }
  };
}
