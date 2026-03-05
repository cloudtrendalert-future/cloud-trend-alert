import { detectContext } from './middlewares/detectContext.js';
import { requireGroupAllowed } from './middlewares/requireGroupAllowed.js';
import { requireFollowVerify } from './middlewares/requireFollowVerify.js';
import { requirePremium } from './middlewares/requirePremium.js';
import { quotaGuard } from './middlewares/quotaGuard.js';
import { cooldownGuard } from './middlewares/cooldownGuard.js';
import { registerStartCommand } from './start.js';
import { registerCallbackRouter } from './ui/callbackRouter.js';
import { freeReplyMenu, premiumReplyMenu } from './ui/replyMenu.js';
import { premiumHomeInline, freeInline } from './ui/inlineMenus.js';
import { getUserPlan, isPremiumUser } from '../../policy/plans.js';
import { premiumRequiredCard } from '../../cards/system/premiumRequiredCard.js';

function parseArgs(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean);
}

async function runMiddlewares(ctx, middlewares, finalHandler) {
  let index = -1;

  async function dispatch(i) {
    if (i <= index) {
      throw new Error('next() called multiple times');
    }
    index = i;

    if (i === middlewares.length) {
      await finalHandler();
      return;
    }

    const middleware = middlewares[i];
    await middleware(ctx, () => dispatch(i + 1));
  }

  await dispatch(0);
}

async function attachPlanState(ctx, deps) {
  if (ctx.chat?.type === 'private') {
    const user = await getUserPlan({ env: deps.env, userRepo: deps.userRepo }, Number(ctx.from.id));
    const premium = isPremiumUser(deps.env, user);

    ctx.state.user = user;
    ctx.state.isPremium = premium;
    ctx.state.isFree = !premium;
    ctx.state.enablePerformance = premium;
    return;
  }

  ctx.state.isPremium = true;
  ctx.state.isFree = false;
  ctx.state.enablePerformance = true;
}

export function registerRouter(bot, deps) {
  bot.use(detectContext());
  bot.use(requireGroupAllowed({ env: deps.env, groupRepo: deps.groupRepo }));

  bot.on('text', async (ctx, next) => {
    const consumed = await deps.wizardCore.handleText(ctx);
    if (consumed) {
      return;
    }

    return next();
  });

  registerStartCommand(bot, deps);

  registerCallbackRouter(bot, {
    env: deps.env,
    userRepo: deps.userRepo,
    wizardCore: deps.wizardCore,
    commands: {
      profit: deps.commands.profit,
      statusClosed: deps.commands.statusClosed,
      pickDateWizard: deps.pickDateWizard
    }
  });

  bot.hears('Get AI Signal', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    await attachPlanState(ctx, deps);

    if (ctx.state.isPremium) {
      await deps.commands.scan(ctx);
      return;
    }

    await runMiddlewares(ctx, [
      requireFollowVerify({ env: deps.env, userRepo: deps.userRepo }),
      quotaGuard({ env: deps.env, userRepo: deps.userRepo, quotaRepo: deps.quotaRepo })
    ], async () => {
      await deps.commands.scan(ctx);
    });
  });

  bot.hears('Join Channel', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    const link = deps.env.requiredChannelUsername
      ? `https://t.me/${deps.env.requiredChannelUsername}`
      : 'Required channel username is not configured.';

    await ctx.reply(link);
  });

  bot.hears('Verify', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    try {
      const member = await ctx.telegram.getChatMember(deps.env.requiredChannelId, Number(ctx.from.id));
      const ok = ['member', 'administrator', 'creator'].includes(member.status);
      if (ok) {
        await deps.userRepo.setFollowVerified(Number(ctx.from.id), true);
        await ctx.reply('Verification successful. You can use /scan now.');
      } else {
        await ctx.reply('Verification failed. Please join the channel first.');
      }
    } catch {
      await ctx.reply('Verification failed. Try again later.');
    }
  });

  bot.hears('Upgrade', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      return;
    }

    const card = premiumRequiredCard();
    await ctx.reply(card.text);
  });

  bot.command('menu', async (ctx) => {
    if (ctx.chat?.type !== 'private') {
      await ctx.reply('Group mode is slash-only.');
      return;
    }

    await attachPlanState(ctx, deps);

    if (ctx.state.isPremium) {
      await ctx.reply('Premium menu loaded.', premiumReplyMenu());
      await ctx.reply('Quick actions:', { reply_markup: { inline_keyboard: premiumHomeInline() } });
      return;
    }

    await ctx.reply('Free menu loaded.', freeReplyMenu());
    await ctx.reply('Quick actions:', { reply_markup: { inline_keyboard: freeInline() } });
  });

  bot.command('scan', async (ctx) => {
    await attachPlanState(ctx, deps);

    const args = parseArgs(ctx.message?.text);

    if (ctx.state.isFree) {
      if (args.length > 0) {
        const card = premiumRequiredCard();
        await ctx.reply(card.text);
        return;
      }

      await runMiddlewares(ctx, [
        requireFollowVerify({ env: deps.env, userRepo: deps.userRepo }),
        quotaGuard({ env: deps.env, userRepo: deps.userRepo, quotaRepo: deps.quotaRepo })
      ], async () => {
        await deps.commands.scan(ctx);
      });
      return;
    }

    if (args.length === 0) {
      await runMiddlewares(ctx, [
        cooldownGuard({ cooldownRepo: deps.cooldownRepo }, 'scan', deps.env.cooldownScanSeconds)
      ], async () => {
        await deps.commands.scan(ctx);
      });
      return;
    }

    if (args.length === 1) {
      await runMiddlewares(ctx, [
        cooldownGuard({ cooldownRepo: deps.cooldownRepo }, 'scan_pair', deps.env.cooldownScanPairSeconds)
      ], async () => {
        await deps.commands.scanPair(ctx, args[0]);
      });
      return;
    }

    await runMiddlewares(ctx, [
      cooldownGuard({ cooldownRepo: deps.cooldownRepo }, 'scan_pair_tf', deps.env.cooldownScanPairTfSeconds)
    ], async () => {
      await deps.commands.scanPairTf(ctx, args[0], args[1]);
    });
  });

  const premiumOnlyMiddleware = async (ctx, next) => {
    await attachPlanState(ctx, deps);
    if (ctx.chat?.type !== 'private') {
      return next();
    }

    return requirePremium({ env: deps.env, userRepo: deps.userRepo })(ctx, next);
  };

  bot.command('status', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      await deps.commands.status(ctx);
    });
  });

  bot.command('statusopen', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      await deps.commands.statusOpen(ctx);
    });
  });

  bot.command('statusclosed', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      const args = parseArgs(ctx.message?.text);
      await deps.commands.statusClosed(ctx, args[0] || null);
    });
  });

  bot.command('cohort', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      const args = parseArgs(ctx.message?.text);
      await deps.commands.cohort(ctx, args[0] || null);
    });
  });

  bot.command('info', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      await deps.commands.info(ctx);
    });
  });

  bot.command('profit', async (ctx) => {
    await runMiddlewares(ctx, [premiumOnlyMiddleware], async () => {
      await deps.commands.profit(ctx);
    });
  });
}
