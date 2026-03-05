function shiftUtcDay(dayUtc, deltaDays) {
  const date = new Date(`${dayUtc}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function tradeDay(trade) {
  if (trade.entryDayUtc) {
    return trade.entryDayUtc;
  }
  if (trade.entryFilledAtUtc) {
    return trade.entryFilledAtUtc.slice(0, 10);
  }
  if (trade.issuedAtUtc) {
    return trade.issuedAtUtc.slice(0, 10);
  }
  return '1970-01-01';
}

export class RetentionService {
  constructor({ env, tradeRepo, dailyStatsRepo, quotaRepo, autoSignalRepo, logger = console }) {
    this.env = env;
    this.tradeRepo = tradeRepo;
    this.dailyStatsRepo = dailyStatsRepo;
    this.quotaRepo = quotaRepo;
    this.autoSignalRepo = autoSignalRepo;
    this.logger = logger;
  }

  async run() {
    const cutoffDayUtc = shiftUtcDay(todayUtc(), -(this.env.retentionDays - 1));

    const trades = await this.tradeRepo.listAll();
    for (const trade of trades) {
      if (tradeDay(trade) < cutoffDayUtc) {
        await this.tradeRepo.delete(trade.id);
      }
    }

    await this.dailyStatsRepo.pruneBefore(cutoffDayUtc);
    await this.quotaRepo.pruneBefore(cutoffDayUtc);
    await this.autoSignalRepo.pruneBefore(cutoffDayUtc);
    this.logger.info?.(`[retention] kept data from ${cutoffDayUtc} onward`);
  }
}
