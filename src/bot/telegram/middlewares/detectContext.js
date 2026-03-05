import { CONTEXT_DM, CONTEXT_GROUP } from '../../../config/constants.js';

export function detectContext() {
  return async (ctx, next) => {
    const type = ctx.chat?.type;
    ctx.state.contextType = type === 'private' ? CONTEXT_DM : CONTEXT_GROUP;
    ctx.state.isDm = ctx.state.contextType === CONTEXT_DM;
    ctx.state.isGroup = ctx.state.contextType === CONTEXT_GROUP;
    await next();
  };
}
