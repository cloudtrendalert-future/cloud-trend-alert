import cron from 'node-cron';
import { buildSignalIdentity, buildDedupeKey } from './dedupe.js';
import { isRenderableSignalCandidate } from '../cards/signals/signalCard.js';

const AUTO_EXCHANGE_PRIORITY = Object.freeze(['binance', 'bybit', 'bitget']);

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export class AutoScheduler {
  constructor({ env, autoRunner, autoSignalRepo, delivery, userRepo, groupRepo, logger = console }) {
    this.env = env;
    this.autoRunner = autoRunner;
    this.autoSignalRepo = autoSignalRepo;
    this.delivery = delivery;
    this.userRepo = userRepo;
    this.groupRepo = groupRepo;
    this.logger = logger;
    this.jobs = [];
    this.running = false;
  }

  start() {
    this.stop();

    this.env.autoCrons.forEach((pattern) => {
      const job = cron.schedule(pattern, async () => {
        try {
          await this.tick();
        } catch (error) {
          this.logger.error?.(`[auto] tick failed: ${error.message}`);
        }
      }, { timezone: 'UTC' });
      this.jobs.push(job);
    });

    this.logger.info?.(`[auto] started with ${this.jobs.length} UTC schedules`);
  }

  stop() {
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
  }

  async tick() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const dayUtc = utcDay();
      const sendCount = await this.autoSignalRepo.getDailySendCount(dayUtc);
      if (sendCount >= this.env.autoMaxSendsPerDay) {
        this.logger.info?.(`[auto] skipped: daily limit reached (${sendCount}/${this.env.autoMaxSendsPerDay})`);
        return;
      }

      const asOfUtc = new Date().toISOString();
      this.logger.info?.(`[auto] cycle started at ${asOfUtc}`);

      for (const exchangeId of AUTO_EXCHANGE_PRIORITY) {
        const result = await this.autoRunner.runByExchange({ exchangeId, asOfUtc });
        const candidate = result.top1;
        if (!candidate) {
          this.logger.info?.(`[auto] ${exchangeId}: no valid signal`);
          continue;
        }

        if (!isRenderableSignalCandidate(candidate)) {
          this.logger.info?.(`[auto] ${exchangeId}: top candidate not renderable, continuing`);
          continue;
        }

        const signalIdentity = buildSignalIdentity(candidate);
        if (!signalIdentity) {
          this.logger.info?.(`[auto] ${exchangeId}: top candidate missing identity, continuing`);
          continue;
        }

        const dedupeKey = buildDedupeKey(signalIdentity);
        const exists = await this.autoSignalRepo.wasSent(dayUtc, dedupeKey);
        if (exists) {
          this.logger.info?.(`[auto] ${exchangeId}: duplicate ${signalIdentity}, continuing`);
          continue;
        }

        const premiumUsers = await this.userRepo.listPremiumUsers();
        const allUsers = await this.userRepo.getAll();
        const freeVerifiedUsers = Object.values(allUsers).filter((user) => user.plan === 'free' && user.followVerified);
        const allowedGroupIds = await this.groupRepo.listAllowedGroupIds();

        const premiumUserIds = premiumUsers.map((user) => Number(user.userId));
        const dmTargets = [...premiumUsers, ...freeVerifiedUsers]
          .map((user) => Number(user.userId))
          .filter((value, index, arr) => arr.indexOf(value) === index);
        const trackPerformance = premiumUserIds.length > 0 || allowedGroupIds.length > 0;

        await this.delivery.sendAutoSignal({
          candidate,
          dmUserIds: dmTargets,
          groupIds: allowedGroupIds,
          trackPerformance
        });

        await this.autoSignalRepo.markSent(dayUtc, dedupeKey);
        await this.autoSignalRepo.incrementDailySend(dayUtc);
        this.logger.info?.(`[auto] ${exchangeId}: selected ${signalIdentity}; cycle stopped`);
        return;
      }

      this.logger.info?.('[auto] cycle ended: no deliverable signal');
    } finally {
      this.running = false;
    }
  }
}
