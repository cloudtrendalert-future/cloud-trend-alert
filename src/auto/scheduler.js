import cron from 'node-cron';
import { buildSignalHash, buildDedupeKey } from './dedupe.js';

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
        return;
      }

      const result = await this.autoRunner.run({ asOfUtc: new Date().toISOString() });
      if (!result.top1) {
        return;
      }

      const signalHash = buildSignalHash(result.top1);
      const dedupeKey = buildDedupeKey(dayUtc, result.top1.symbol, signalHash);
      const exists = await this.autoSignalRepo.wasSent(dayUtc, dedupeKey);
      if (exists) {
        return;
      }

      await this.autoSignalRepo.markSent(dayUtc, dedupeKey);
      await this.autoSignalRepo.incrementDailySend(dayUtc);

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
        candidate: result.top1,
        dmUserIds: dmTargets,
        groupIds: allowedGroupIds,
        trackPerformance
      });
    } finally {
      this.running = false;
    }
  }
}
