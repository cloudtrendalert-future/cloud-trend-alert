export function createGroupSender(bot) {
  return {
    async sendCard(groupId, card) {
      return bot.telegram.sendMessage(groupId, card.text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    },

    async sendText(groupId, text) {
      return bot.telegram.sendMessage(groupId, text);
    }
  };
}
