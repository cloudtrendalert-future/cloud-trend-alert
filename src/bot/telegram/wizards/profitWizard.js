import { renderCard, section } from '../../../cards/base/layout.js';
import { wizardCancelButtons } from '../../../cards/base/nav.js';

function toNumber(raw) {
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

function inline(buttonRows) {
  return { reply_markup: { inline_keyboard: buttonRows } };
}

async function safeDeleteInput(ctx) {
  try {
    await ctx.deleteMessage(ctx.message.message_id);
  } catch {
    // silent by spec
  }
}

function stepPrompt(mode, step, data = {}) {
  if (mode === 'simple') {
    if (step === 1) return 'Simple mode: enter capital (USDT).';
    if (step === 2) return 'Simple mode: enter leverage (e.g. 10).';
    return 'Simple mode: enter expected move percent (e.g. 5 for +5%).';
  }

  if (step === 0) return 'Entry mode: choose direction.';
  if (step === 1) return 'Step 2/7: enter capital (USDT).';
  if (step === 2) return 'Step 3/7: enter leverage (e.g. 10).';
  if (step === 3) return 'Step 4/7: enter entry price.';
  if (step === 4) return 'Step 5/7: enter TP1 price.';
  if (step === 5) return 'Step 6/7: enter TP2 price.';
  if (step === 6) return 'Step 7/7: enter TP3 price.';
  return `Direction: ${data.direction || '-'}`;
}

function resultCardEntry(data) {
  const { direction, capital, leverage, entry, tp1, tp2, tp3 } = data;

  function calc(tp) {
    const pct = direction === 'LONG'
      ? ((tp - entry) / entry) * 100
      : ((entry - tp) / entry) * 100;
    const roi = pct * leverage;
    const pnl = (capital * roi) / 100;
    return { pct, roi, pnl };
  }

  const p1 = calc(tp1);
  const p2 = calc(tp2);
  const p3 = calc(tp3);

  return {
    text: renderCard({
      title: 'Profit Simulator (Entry-Based)',
      sections: [
        section('INPUT', [
          `Direction: ${direction}`,
          `Capital: ${capital}`,
          `Leverage: ${leverage}x`,
          `Entry: ${entry}`
        ]),
        section('RESULT', [
          `TP1 ${tp1}: ROI ${p1.roi.toFixed(2)}% | PnL ${formatMoney(p1.pnl)} USDT`,
          `TP2 ${tp2}: ROI ${p2.roi.toFixed(2)}% | PnL ${formatMoney(p2.pnl)} USDT`,
          `TP3 ${tp3}: ROI ${p3.roi.toFixed(2)}% | PnL ${formatMoney(p3.pnl)} USDT`
        ])
      ]
    }),
    buttons: [
      [
        { text: 'Recalculate', callback_data: 'wizard:profit:recalculate' },
        { text: 'Switch Simple', callback_data: 'wizard:profit:switch_simple' }
      ],
      [{ text: 'Close', callback_data: 'nav:close' }]
    ]
  };
}

function resultCardSimple(data) {
  const roi = data.movePct * data.leverage;
  const pnl = (data.capital * roi) / 100;

  return {
    text: renderCard({
      title: 'Profit Simulator (Simple)',
      sections: [
        section('INPUT', [
          `Capital: ${data.capital}`,
          `Leverage: ${data.leverage}x`,
          `Move: ${data.movePct}%`
        ]),
        section('RESULT', [
          `ROI: ${roi.toFixed(2)}%`,
          `PnL: ${formatMoney(pnl)} USDT`
        ])
      ]
    }),
    buttons: [
      [
        { text: 'Recalculate', callback_data: 'wizard:profit:recalculate' },
        { text: 'Switch Entry', callback_data: 'wizard:profit:switch_entry' }
      ],
      [{ text: 'Close', callback_data: 'nav:close' }]
    ]
  };
}

async function upsertWizardMessage(ctx, session, text, buttons) {
  const extra = buttons ? inline(buttons) : {};
  if (session.messageId) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, session.messageId, undefined, text, extra);
      return session.messageId;
    } catch {
      // fall through and send new
    }
  }

  const sent = await ctx.reply(text, extra);
  return sent.message_id;
}

export class ProfitWizard {
  constructor({ wizardCore }) {
    this.wizardCore = wizardCore;
  }

  async start(ctx) {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    const userId = Number(ctx.from.id);
    const session = {
      type: 'profit',
      mode: null,
      step: 0,
      data: {}
    };

    const messageId = await upsertWizardMessage(
      ctx,
      session,
      'Profit Simulator: choose mode.',
      [
        [
          { text: 'Simple (Percent)', callback_data: 'wizard:profit:mode_simple' },
          { text: 'Entry-Based (Prices)', callback_data: 'wizard:profit:mode_entry' }
        ],
        ...wizardCancelButtons()
      ]
    );

    await this.wizardCore.setSession(userId, {
      ...session,
      messageId
    });
  }

  async handleCallback(ctx, session, data) {
    const userId = Number(ctx.from.id);

    if (data === 'wizard:cancel') {
      await this.wizardCore.clearSession(userId);
      await ctx.answerCbQuery('Cancelled');
      return;
    }

    if (data === 'wizard:profit:mode_simple') {
      const next = { ...session, mode: 'simple', step: 1, data: {} };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('simple', 1), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    if (data === 'wizard:profit:mode_entry') {
      const next = { ...session, mode: 'entry', step: 0, data: {} };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('entry', 0), [
        [
          { text: 'LONG', callback_data: 'wizard:profit:dir_long' },
          { text: 'SHORT', callback_data: 'wizard:profit:dir_short' }
        ],
        ...wizardCancelButtons()
      ]);
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    if (session.mode === 'entry' && data === 'wizard:profit:dir_long') {
      const next = { ...session, step: 1, data: { ...session.data, direction: 'LONG' } };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('entry', 1), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    if (session.mode === 'entry' && data === 'wizard:profit:dir_short') {
      const next = { ...session, step: 1, data: { ...session.data, direction: 'SHORT' } };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('entry', 1), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    if (data === 'wizard:profit:recalculate') {
      await this.start(ctx);
      return ctx.answerCbQuery();
    }

    if (data === 'wizard:profit:switch_simple') {
      const next = { ...session, mode: 'simple', step: 1, data: {} };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('simple', 1), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    if (data === 'wizard:profit:switch_entry') {
      const next = { ...session, mode: 'entry', step: 0, data: {} };
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('entry', 0), [
        [
          { text: 'LONG', callback_data: 'wizard:profit:dir_long' },
          { text: 'SHORT', callback_data: 'wizard:profit:dir_short' }
        ],
        ...wizardCancelButtons()
      ]);
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return ctx.answerCbQuery();
    }

    return ctx.answerCbQuery();
  }

  async handleText(ctx, session) {
    const userId = Number(ctx.from.id);
    const text = ctx.message?.text || '';
    await safeDeleteInput(ctx);

    if (session.mode === 'simple') {
      await this.handleSimpleText(ctx, session, userId, text);
      return;
    }

    if (session.mode === 'entry') {
      await this.handleEntryText(ctx, session, userId, text);
    }
  }

  async handleSimpleText(ctx, session, userId, text) {
    const value = toNumber(text);
    if (!value || value <= 0) {
      const messageId = await upsertWizardMessage(ctx, session, 'Invalid number. Try again.', wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...session, messageId });
      return;
    }

    const next = { ...session, data: { ...session.data } };

    if (session.step === 1) {
      next.data.capital = value;
      next.step = 2;
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('simple', 2), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return;
    }

    if (session.step === 2) {
      next.data.leverage = value;
      next.step = 3;
      const messageId = await upsertWizardMessage(ctx, next, stepPrompt('simple', 3), wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return;
    }

    next.data.movePct = value;
    const result = resultCardSimple(next.data);
    const messageId = await upsertWizardMessage(ctx, next, result.text, result.buttons);
    await this.wizardCore.setSession(userId, { ...next, messageId, step: 99 });
  }

  async handleEntryText(ctx, session, userId, text) {
    const value = toNumber(text);
    if (!value || value <= 0) {
      const messageId = await upsertWizardMessage(ctx, session, 'Invalid number. Try again.', wizardCancelButtons());
      await this.wizardCore.setSession(userId, { ...session, messageId });
      return;
    }

    const next = { ...session, data: { ...session.data } };

    if (session.step === 1) {
      next.data.capital = value;
      next.step = 2;
    } else if (session.step === 2) {
      next.data.leverage = value;
      next.step = 3;
    } else if (session.step === 3) {
      next.data.entry = value;
      next.step = 4;
    } else if (session.step === 4) {
      next.data.tp1 = value;
      next.step = 5;
    } else if (session.step === 5) {
      next.data.tp2 = value;
      next.step = 6;
    } else if (session.step === 6) {
      next.data.tp3 = value;
      next.step = 99;
    }

    if (next.step === 99) {
      const result = resultCardEntry(next.data);
      const messageId = await upsertWizardMessage(ctx, next, result.text, result.buttons);
      await this.wizardCore.setSession(userId, { ...next, messageId });
      return;
    }

    const messageId = await upsertWizardMessage(ctx, next, stepPrompt('entry', next.step, next.data), wizardCancelButtons());
    await this.wizardCore.setSession(userId, { ...next, messageId });
  }
}
