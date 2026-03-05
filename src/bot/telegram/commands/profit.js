export function createProfitCommand({ profitWizard }) {
  return async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Profit Simulator is DM-only.');
      return;
    }

    await profitWizard.start(ctx);
  };
}
