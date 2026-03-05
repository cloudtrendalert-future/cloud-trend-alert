import { wizardCancelButtons } from '../../../cards/base/nav.js';

function isDateDdMmYyyy(value) {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

function inline(buttons) {
  return { reply_markup: { inline_keyboard: buttons } };
}

export class PickDateWizard {
  constructor({ wizardCore }) {
    this.wizardCore = wizardCore;
  }

  async start(ctx, purpose = 'statusclosed') {
    const userId = Number(ctx.from.id);
    const sent = await ctx.reply('Send date in DD-MM-YYYY format.', inline(wizardCancelButtons()));

    await this.wizardCore.setSession(userId, {
      type: 'pickDate',
      purpose,
      messageId: sent.message_id
    });
  }

  async handleCallback(ctx, _session, data) {
    if (data === 'wizard:cancel') {
      await this.wizardCore.clearSession(Number(ctx.from.id));
      await ctx.answerCbQuery('Cancelled');
      return;
    }

    await ctx.answerCbQuery();
  }

  async handleText(ctx, session) {
    const text = (ctx.message?.text || '').trim();
    const userId = Number(ctx.from.id);

    try {
      await ctx.deleteMessage(ctx.message.message_id);
    } catch {
      // silent by spec
    }

    if (!isDateDdMmYyyy(text)) {
      await ctx.reply('Invalid date format. Use DD-MM-YYYY.');
      return;
    }

    await this.wizardCore.clearSession(userId);
    await ctx.reply(`Picked date: ${text}. Run /${session.purpose} ${text}`);
  }
}
