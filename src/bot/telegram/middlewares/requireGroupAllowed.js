import { ensureGroupAllowance } from '../../../policy/groupPolicy.js';
import { groupNotAllowedCard } from '../../../cards/system/groupNotAllowedCard.js';

function parseCommand(text) {
  const value = String(text || '').trim();
  if (!value.startsWith('/')) {
    return null;
  }
  return value.split(/\s+/)[0];
}

export function requireGroupAllowed({ env, groupRepo, logger = console }) {
  return async (ctx, next) => {
    if (ctx.chat?.type === 'private') {
      return next();
    }

    const groupId = Number(ctx.chat?.id);
    const title = String(ctx.chat?.title || '');
    const safeTitle = title.replaceAll('"', '\'');
    const command = parseCommand(ctx.message?.text);
    const result = await ensureGroupAllowance({ env, groupRepo }, groupId, title);

    if (result.allowed) {
      if (command) {
        logger.info?.(`[group] allowed command=${command} chat=${groupId} group="${safeTitle}"`);
      }
      return next();
    }

    logger.warn?.(`[group] denied chat=${groupId} group="${safeTitle}" command=${command || 'n/a'}`);

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
