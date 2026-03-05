import { Markup } from 'telegraf';

function toInlineKeyboard(buttonRows) {
  if (!buttonRows?.length) {
    return undefined;
  }

  const rows = buttonRows.map((row) => row.map((button) => {
    if (button.url) {
      return Markup.button.url(button.text, button.url);
    }
    return Markup.button.callback(button.text, button.callback_data);
  }));

  return Markup.inlineKeyboard(rows);
}

export function createDmSender(bot) {
  return {
    async sendCard(chatId, card, { buttons = true } = {}) {
      const markup = buttons ? toInlineKeyboard(card.buttons) : undefined;
      return bot.telegram.sendMessage(chatId, card.text, {
        parse_mode: 'HTML',
        ...(markup ? markup : {})
      });
    },

    async sendText(chatId, text, extra = {}) {
      return bot.telegram.sendMessage(chatId, text, extra);
    }
  };
}
