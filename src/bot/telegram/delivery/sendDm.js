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

export function createDmSender(bot, { logger = console } = {}) {
  function normalizeTargets(targets) {
    return [...new Set((targets || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value !== 0))];
  }

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
    },

    async sendCardBatch(chatIds, card, { buttons = true, lane = 'general' } = {}) {
      const targets = normalizeTargets(chatIds);
      if (!targets.length) {
        logger.info?.(`[delivery] type=dm lane=${lane} targets=0 sent=0`);
        return { targets: 0, sent: 0 };
      }

      const results = await Promise.allSettled(
        targets.map((chatId) => this.sendCard(chatId, card, { buttons }))
      );
      const sent = results.filter((result) => result.status === 'fulfilled').length;
      logger.info?.(`[delivery] type=dm lane=${lane} targets=${targets.length} sent=${sent}`);
      return { targets: targets.length, sent };
    }
  };
}
