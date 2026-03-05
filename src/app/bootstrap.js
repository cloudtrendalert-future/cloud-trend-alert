import path from 'node:path';
import { Telegraf } from 'telegraf';
import { env, validateEnv } from '../config/env.js';
import { JsonStore } from '../storage/jsonStore.js';
import { UserRepo } from '../storage/repos/userRepo.js';
import { QuotaRepo } from '../storage/repos/quotaRepo.js';
import { CooldownRepo } from '../storage/repos/cooldownRepo.js';
import { GroupRepo } from '../storage/repos/groupRepo.js';
import { SessionRepo } from '../storage/repos/sessionRepo.js';
import { TradeRepo } from '../storage/repos/tradeRepo.js';
import { DailyStatsRepo } from '../storage/repos/dailyStatsRepo.js';
import { AutoSignalRepo } from '../storage/repos/autoSignalRepo.js';
import { StateRepo } from '../storage/repos/stateRepo.js';
import { BinanceUsdmAdapter } from '../exchanges/adapters/binanceUsdm.js';
import { BybitUsdtPerpAdapter } from '../exchanges/adapters/bybitUsdtPerp.js';
import { BitgetUsdtPerpAdapter } from '../exchanges/adapters/bitgetUsdtPerp.js';
import { UniverseProvider } from '../exchanges/universe/universeProvider.js';
import { TtlCache } from '../marketdata/cache.js';
import { AsyncLimiter } from '../marketdata/rateLimit.js';
import { KlinesService } from '../marketdata/klinesService.js';
import { buildStrategyRegistry } from '../strategies/registry.js';
import { Scorer } from '../scoring/scorer.js';
import { ManualRunner } from '../funnel/manualRunner.js';
import { AutoRunner } from '../funnel/autoRunner.js';
import { AutoScheduler } from '../auto/scheduler.js';
import { TradeMonitor } from '../performance/tradeMonitor.js';
import { DailyAggregator } from '../performance/dailyAggregator.js';
import { RetentionService } from '../performance/retention.js';
import { WizardCore } from '../bot/telegram/wizards/wizardCore.js';
import { ProfitWizard } from '../bot/telegram/wizards/profitWizard.js';
import { PickDateWizard } from '../bot/telegram/wizards/pickDateWizard.js';
import { registerRouter } from '../bot/telegram/router.js';
import { createScanCommand } from '../bot/telegram/commands/scan.js';
import { createScanPairCommand } from '../bot/telegram/commands/scanPair.js';
import { createScanPairTfCommand } from '../bot/telegram/commands/scanPairTf.js';
import { createStatusCommand } from '../bot/telegram/commands/status.js';
import { createStatusOpenCommand } from '../bot/telegram/commands/statusOpen.js';
import { createStatusClosedCommand } from '../bot/telegram/commands/statusClosed.js';
import { createCohortCommand } from '../bot/telegram/commands/cohort.js';
import { createInfoCommand } from '../bot/telegram/commands/info.js';
import { createProfitCommand } from '../bot/telegram/commands/profit.js';
import { createDmSender } from '../bot/telegram/delivery/sendDm.js';
import { createGroupSender } from '../bot/telegram/delivery/sendGroups.js';
import { autoTop1Card } from '../cards/signals/autoTop1Card.js';
import { progressUpdateCard } from '../cards/signals/progressUpdateCard.js';

function file(dataDir, name) {
  return path.join(dataDir, name);
}

export async function bootstrapApp({ dryRun = false } = {}) {
  const validation = validateEnv();
  if (!validation.ok) {
    throw new Error(`Env validation failed: ${validation.errors.join(', ')}`);
  }

  const stores = {
    users: new JsonStore(file(env.dataDir, 'users.json'), {}),
    quotas: new JsonStore(file(env.dataDir, 'quotas.json'), {}),
    cooldowns: new JsonStore(file(env.dataDir, 'cooldowns.json'), {}),
    groups: new JsonStore(file(env.dataDir, 'groups.json'), {}),
    sessions: new JsonStore(file(env.dataDir, 'sessions.json'), {}),
    trades: new JsonStore(file(env.dataDir, 'trades.json'), {}),
    dailyStats: new JsonStore(file(env.dataDir, 'daily-stats.json'), {}),
    autoSignals: new JsonStore(file(env.dataDir, 'auto-signals.json'), {}),
    state: new JsonStore(file(env.dataDir, 'state.json'), {})
  };

  const repos = {
    userRepo: new UserRepo(stores.users),
    quotaRepo: new QuotaRepo(stores.quotas),
    cooldownRepo: new CooldownRepo(stores.cooldowns),
    groupRepo: new GroupRepo(stores.groups),
    sessionRepo: new SessionRepo(stores.sessions),
    tradeRepo: new TradeRepo(stores.trades),
    dailyStatsRepo: new DailyStatsRepo(stores.dailyStats),
    autoSignalRepo: new AutoSignalRepo(stores.autoSignals),
    stateRepo: new StateRepo(stores.state)
  };

  await Promise.all(env.premiumUserIds.map((userId) => repos.userRepo.upsertUser(userId, { plan: 'premium' })));
  await Promise.all(env.allowedGroupIds.map((groupId) => repos.groupRepo.setAllowed(groupId, true)));

  const adapters = [
    new BinanceUsdmAdapter({ timeoutMs: env.marketdataTimeoutMs }),
    new BybitUsdtPerpAdapter({ timeoutMs: env.marketdataTimeoutMs }),
    new BitgetUsdtPerpAdapter({ timeoutMs: env.marketdataTimeoutMs })
  ];

  const universeProvider = new UniverseProvider({ adapters });
  const klinesService = new KlinesService({
    adapters,
    cache: new TtlCache({ ttlMs: env.klinesCacheTtlSeconds * 1000 }),
    limiter: new AsyncLimiter(env.maxConcurrentScans)
  });

  const strategies = buildStrategyRegistry();
  const scorer = new Scorer();

  const manualRunner = new ManualRunner({
    universeProvider,
    klinesService,
    strategies,
    scorer,
    env
  });

  const autoRunner = new AutoRunner({
    universeProvider,
    klinesService,
    strategies,
    scorer,
    env
  });

  const dailyAggregator = new DailyAggregator({
    tradeRepo: repos.tradeRepo,
    dailyStatsRepo: repos.dailyStatsRepo
  });

  const tradeMonitor = new TradeMonitor({
    tradeRepo: repos.tradeRepo,
    klinesService,
    dailyAggregator
  });

  const retentionService = new RetentionService({
    env,
    tradeRepo: repos.tradeRepo,
    dailyStatsRepo: repos.dailyStatsRepo,
    quotaRepo: repos.quotaRepo,
    autoSignalRepo: repos.autoSignalRepo
  });

  if (dryRun) {
    return {
      env,
      repos,
      services: {
        universeProvider,
        klinesService,
        manualRunner,
        autoRunner,
        dailyAggregator,
        tradeMonitor,
        retentionService
      }
    };
  }

  const bot = new Telegraf(env.botToken);

  const wizardCore = new WizardCore({ sessionRepo: repos.sessionRepo });
  const profitWizard = new ProfitWizard({ wizardCore });
  const pickDateWizard = new PickDateWizard({ wizardCore });
  wizardCore.register('profit', profitWizard);
  wizardCore.register('pickDate', pickDateWizard);

  const commands = {
    scan: createScanCommand({ manualRunner, tradeMonitor, env }),
    scanPair: createScanPairCommand({ manualRunner, tradeMonitor }),
    scanPairTf: createScanPairTfCommand({ manualRunner, tradeMonitor }),
    status: createStatusCommand({ dailyAggregator }),
    statusOpen: createStatusOpenCommand({ tradeRepo: repos.tradeRepo }),
    statusClosed: createStatusClosedCommand({ env, tradeRepo: repos.tradeRepo }),
    cohort: createCohortCommand({ env, dailyAggregator }),
    info: createInfoCommand({ dailyAggregator }),
    profit: createProfitCommand({ profitWizard })
  };

  registerRouter(bot, {
    env,
    ...repos,
    commands,
    wizardCore,
    pickDateWizard
  });

  const dmSender = createDmSender(bot);
  const groupSender = createGroupSender(bot);

  tradeMonitor.onProgress = async ({ trade, event }) => {
    const card = progressUpdateCard({
      symbol: trade.symbol,
      event,
      direction: trade.direction,
      timeframe: trade.timeframe,
      message: `Status: ${trade.status}`
    });

    const premiumUsers = await repos.userRepo.listPremiumUsers();
    const allowedGroupIds = await repos.groupRepo.listAllowedGroupIds();

    await Promise.all(premiumUsers.map(async (user) => {
      try {
        await dmSender.sendCard(user.userId, card, { buttons: false });
      } catch {
        // ignore blocked DMs
      }
    }));

    await Promise.all(allowedGroupIds.map(async (groupId) => {
      try {
        await groupSender.sendCard(groupId, card);
      } catch {
        // ignore send failures
      }
    }));
  };

  const delivery = {
    async sendAutoSignal({ candidate, dmUserIds, groupIds, trackPerformance }) {
      const card = autoTop1Card(candidate);

      await Promise.all(dmUserIds.map(async (userId) => {
        try {
          await dmSender.sendCard(userId, card, { buttons: false });
        } catch {
          // ignore blocked DMs
        }
      }));

      await Promise.all(groupIds.map(async (groupId) => {
        try {
          await groupSender.sendCard(groupId, card);
        } catch {
          // ignore group failures
        }
      }));

      if (trackPerformance) {
        await tradeMonitor.onSignalIssued(candidate);
      }
    }
  };

  const autoScheduler = new AutoScheduler({
    env,
    autoRunner,
    autoSignalRepo: repos.autoSignalRepo,
    delivery,
    userRepo: repos.userRepo,
    groupRepo: repos.groupRepo
  });

  await retentionService.run();
  await repos.stateRepo.set('lastBootAtUtc', new Date().toISOString());

  const monitorInterval = setInterval(() => {
    tradeMonitor.tick().catch((error) => console.error('[trade-monitor]', error));
  }, 60_000);

  const retentionInterval = setInterval(() => {
    retentionService.run().catch((error) => console.error('[retention]', error));
  }, 6 * 60 * 60 * 1000);

  return {
    bot,
    autoScheduler,
    stop: async () => {
      clearInterval(monitorInterval);
      clearInterval(retentionInterval);
      autoScheduler.stop();
      bot.stop('app-stop');
    },
    start: async () => {
      await bot.launch({ dropPendingUpdates: true });
      autoScheduler.start();
      await tradeMonitor.tick();
    }
  };
}
