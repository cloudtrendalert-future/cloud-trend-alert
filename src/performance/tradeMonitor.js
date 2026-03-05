import { TRADE_STATUS } from '../config/constants.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toMs(iso) {
  return new Date(iso).getTime();
}

function utcDay(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function hitTp(trade, high, low) {
  const [tp1, tp2, tp3] = trade.takeProfits || [];

  if (trade.direction === 'LONG') {
    if (tp3 && high >= tp3.price) return 3;
    if (tp2 && high >= tp2.price) return 2;
    if (tp1 && high >= tp1.price) return 1;
  } else {
    if (tp3 && low <= tp3.price) return 3;
    if (tp2 && low <= tp2.price) return 2;
    if (tp1 && low <= tp1.price) return 1;
  }

  return 0;
}

function hitSl(trade, high, low) {
  if (trade.direction === 'LONG') {
    return low <= trade.stopLoss.price;
  }

  return high >= trade.stopLoss.price;
}

export class TradeMonitor {
  constructor({ tradeRepo, klinesService, dailyAggregator, onProgress = null, logger = console }) {
    this.tradeRepo = tradeRepo;
    this.klinesService = klinesService;
    this.dailyAggregator = dailyAggregator;
    this.onProgress = onProgress;
    this.logger = logger;
  }

  async onSignalIssued(candidate, issuedAtUtc = new Date().toISOString()) {
    const entryFilledAtUtc = issuedAtUtc;
    const entryDayUtc = utcDay(entryFilledAtUtc);

    const trade = await this.tradeRepo.create({
      symbol: candidate.symbol,
      issuedAtUtc,
      entryFilledAtUtc,
      entryDayUtc,
      expiresAtUtc: new Date(toMs(entryFilledAtUtc) + SEVEN_DAYS_MS).toISOString(),
      signalHash: candidate.signalHash || '',
      strategyId: candidate.signal.strategyId,
      direction: candidate.signal.direction,
      timeframe: candidate.signal.timeframe,
      entry: candidate.signal.entry,
      stopLoss: candidate.signal.stopLoss,
      takeProfits: candidate.signal.takeProfits,
      maxTPReached: 0,
      status: TRADE_STATUS.ACTIVE
    });

    await this.dailyAggregator.rebuildDay(entryDayUtc);
    return trade;
  }

  async tick() {
    const open = await this.tradeRepo.listOpen();
    const nowMs = Date.now();
    const touchedDays = new Set();

    for (const trade of open) {
      if (trade.status === TRADE_STATUS.PENDING_ENTRY) {
        if (nowMs >= toMs(trade.issuedAtUtc) + SEVEN_DAYS_MS) {
          const patch = {
            status: TRADE_STATUS.EXPIRED_UNFILLED,
            expiresAtUtc: new Date(nowMs).toISOString()
          };
          await this.tradeRepo.update(trade.id, {
            ...patch
          });
          await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'EXPIRED_UNFILLED' });
        }
        continue;
      }

      if (trade.status !== TRADE_STATUS.ACTIVE) {
        continue;
      }

      const filledAt = trade.entryFilledAtUtc ? toMs(trade.entryFilledAtUtc) : 0;
      if (filledAt && nowMs >= filledAt + SEVEN_DAYS_MS) {
        const patch = {
          status: TRADE_STATUS.EXPIRED_ACTIVE,
          expiresAtUtc: new Date(nowMs).toISOString()
        };
        await this.tradeRepo.update(trade.id, {
          ...patch
        });
        await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'EXPIRED_ACTIVE' });
        if (trade.entryDayUtc) {
          touchedDays.add(trade.entryDayUtc);
        }
        continue;
      }

      const tf = trade.timeframe || '1h';
      const klines = await this.klinesService.fetchKlines(trade.symbol, tf, 3);
      const last = klines.at(-1);
      if (!last) {
        continue;
      }

      const high = last.high;
      const low = last.low;

      const tpReached = hitTp(trade, high, low);
      const slHit = hitSl(trade, high, low);

      const patch = {};
      if (tpReached > (trade.maxTPReached || 0)) {
        patch.maxTPReached = tpReached;
        const stamp = new Date(nowMs).toISOString();
        if (tpReached >= 1 && !trade.tp1HitAtUtc) patch.tp1HitAtUtc = stamp;
        if (tpReached >= 2 && !trade.tp2HitAtUtc) patch.tp2HitAtUtc = stamp;
        if (tpReached >= 3 && !trade.tp3HitAtUtc) patch.tp3HitAtUtc = stamp;
      }

      if (slHit && (trade.maxTPReached || 0) === 0) {
        patch.slHitAtUtc = new Date(nowMs).toISOString();
        patch.status = TRADE_STATUS.CLOSED;
      }

      if ((trade.maxTPReached || patch.maxTPReached || 0) >= 3) {
        patch.status = TRADE_STATUS.CLOSED;
      }

      if (Object.keys(patch).length) {
        await this.tradeRepo.update(trade.id, patch);
        if (patch.tp3HitAtUtc) {
          await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'TP3' });
        } else if (patch.tp2HitAtUtc) {
          await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'TP2' });
        } else if (patch.tp1HitAtUtc) {
          await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'TP1' });
        } else if (patch.slHitAtUtc) {
          await this.onProgress?.({ trade: { ...trade, ...patch }, event: 'SL' });
        }

        if (trade.entryDayUtc) {
          touchedDays.add(trade.entryDayUtc);
        }
      }
    }

    for (const day of touchedDays) {
      await this.dailyAggregator.rebuildDay(day);
    }
  }
}
