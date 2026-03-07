export function createGroupSender(bot, { logger = console } = {}) {
  function normalizeTargets(targets) {
    return [...new Set((targets || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value !== 0))];
  }

  return {
    async sendCard(groupId, card) {
      return bot.telegram.sendMessage(groupId, card.text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    },

    async sendText(groupId, text) {
      return bot.telegram.sendMessage(groupId, text);
    },

    async sendCardBatch(groupIds, card, { lane = 'general' } = {}) {
      const targets = normalizeTargets(groupIds);
      if (!targets.length) {
        logger.info?.(`[delivery] type=group lane=${lane} targets=0 sent=0`);
        return { targets: 0, sent: 0 };
      }

      const results = await Promise.allSettled(
        targets.map((groupId) => this.sendCard(groupId, card))
      );
      const sent = results.filter((result) => result.status === 'fulfilled').length;
      logger.info?.(`[delivery] type=group lane=${lane} targets=${targets.length} sent=${sent}`);
      return { targets: targets.length, sent };
    }
  };
}
