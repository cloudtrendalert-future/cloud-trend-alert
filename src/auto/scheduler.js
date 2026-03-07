import cron from 'node-cron';
import {
  buildSignalIdentity,
  buildDedupeKey,
  resolveCooldownMs,
  getCooldownStatus
} from './dedupe.js';
import { isRenderableSignalCandidate } from '../cards/signals/signalCard.js';
import { EXCHANGES } from '../config/constants.js';
import { mergeAndDedupeCandidates } from '../funnel/candidateMerge.js';

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

      const mergedCandidates = [];
      for (const exchangeId of EXCHANGES) {
        this.logger.info?.(`[auto] pass start exchange=${exchangeId}`);
        const result = await this.autoRunner.runByExchange({ exchangeId, asOfUtc });
        const stage1Count = result.debug?.stage1Count ?? 0;
        const stage2Count = result.debug?.stage2Count ?? 0;
        const stage3Count = result.debug?.stage3Count ?? 0;
        const rawCandidates = Array.isArray(result.candidates)
          ? result.candidates
          : (result.top1 ? [result.top1] : []);
        const exchangeCandidates = rawCandidates.map((candidate) => ({ ...candidate, exchangeId }));
        mergedCandidates.push(...exchangeCandidates);

        this.logger.info?.(
          `[auto] pass done exchange=${exchangeId} stage1=${stage1Count} stage2=${stage2Count} stage3=${stage3Count} qualified=${rawCandidates.length}`
        );
      }

      const merged = mergeAndDedupeCandidates(mergedCandidates);
      this.logger.info?.(
        `[auto] aggregate exchanges=${EXCHANGES.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} ranked=${merged.ranked.length}`
      );

      let candidate = null;
      let signalIdentity = '';
      let dedupeKey = '';

      for (const rankedCandidate of merged.ranked) {
        if (!isRenderableSignalCandidate(rankedCandidate)) {
          this.logger.info?.('[auto] ranked candidate not renderable, continuing');
          continue;
        }

        signalIdentity = buildSignalIdentity(rankedCandidate);
        if (!signalIdentity) {
          this.logger.info?.('[auto] ranked candidate missing identity, continuing');
          continue;
        }

        dedupeKey = buildDedupeKey(signalIdentity);
        const lastSentAtUtc = await this.autoSignalRepo.getLastSentAt(dedupeKey);
        const cooldownMs = resolveCooldownMs(rankedCandidate);
        const cooldownStatus = getCooldownStatus({
          lastSentAtUtc,
          cooldownMs,
          asOfUtc
        });

        if (cooldownStatus.inCooldown) {
          const remainingMinutes = Math.ceil(cooldownStatus.remainingMs / 60000);
          this.logger.info?.(
            `[auto] duplicate ${signalIdentity} within cooldown (${remainingMinutes}m left), continuing`
          );
          continue;
        }

        if (lastSentAtUtc) {
          this.logger.info?.(`[auto] cooldown expired for ${signalIdentity}, signal allowed`);
        }

        candidate = rankedCandidate;
        break;
      }

      if (!candidate) {
        this.logger.info?.(
          `[auto] cycle ended: no deliverable signal exchanges=${EXCHANGES.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} selected=0`
        );
        return;
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

      const deliverySummary = await this.delivery.sendAutoSignal({
        candidate,
        dmUserIds: dmTargets,
        groupIds: allowedGroupIds,
        trackPerformance
      });

      await this.autoSignalRepo.setLastSentAt(dedupeKey, asOfUtc);
      await this.autoSignalRepo.incrementDailySend(dayUtc);
      this.logger.info?.(
        `[auto] delivery dm=${deliverySummary.dmSent}/${deliverySummary.dmTargets} groups=${deliverySummary.groupSent}/${deliverySummary.groupTargets}`
      );
      this.logger.info?.(
        `[auto] top1 selected identity=${signalIdentity} exchange=${candidate.exchangeId || 'unknown'} selected=1`
      );
    } finally {
      this.running = false;
      this.logger.info?.('[auto] cycle stopped');
    }
  }
}
