import { summarizeOutcomes } from './outcomeBuckets.js';

export function utcDayFromIso(iso) {
  return iso.slice(0, 10);
}

export class DailyAggregator {
  constructor({ tradeRepo, dailyStatsRepo }) {
    this.tradeRepo = tradeRepo;
    this.dailyStatsRepo = dailyStatsRepo;
  }

  async rebuildDay(dayUtc) {
    const trades = await this.tradeRepo.listByEntryDayRange(dayUtc, dayUtc);
    const summary = summarizeOutcomes(trades);

    await this.dailyStatsRepo.upsertDay(dayUtc, {
      tp1Count: summary.tp1,
      tp2Count: summary.tp2,
      tp3Count: summary.tp3,
      slCount: summary.sl,
      expiredCount: summary.expired,
      entriesCount: summary.entries,
      longCount: summary.longCount,
      shortCount: summary.shortCount
    });

    return summary;
  }

  async rangeSummary(startDayUtc, endDayUtc) {
    const trades = await this.tradeRepo.listByEntryDayRange(startDayUtc, endDayUtc);
    return summarizeOutcomes(trades);
  }
}
