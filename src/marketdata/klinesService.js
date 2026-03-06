import { TIMEFRAMES } from '../config/constants.js';

export class KlinesService {
  constructor({ adapters, cache, limiter, logger = console }) {
    this.adapters = adapters;
    this.cache = cache;
    this.limiter = limiter;
    this.logger = logger;
  }

  cacheKey(unifiedSymbol, tf, limit) {
    return `${unifiedSymbol}:${tf}:${limit}`;
  }

  async fetchKlines(unifiedSymbol, tf, limit = 300) {
    if (!TIMEFRAMES.includes(tf)) {
      throw new Error(`Unsupported timeframe: ${tf}`);
    }

    const key = this.cacheKey(unifiedSymbol, tf, limit);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const data = await this.limiter.run(async () => {
      for (const adapter of this.adapters) {
        if (adapter.universeReady === false) {
          continue;
        }

        if (typeof adapter.canTradeSymbol === 'function' && !adapter.canTradeSymbol(unifiedSymbol)) {
          continue;
        }

        try {
          const rows = await adapter.fetchKlines(unifiedSymbol, tf, limit);
          if (Array.isArray(rows) && rows.length > 20) {
            return rows;
          }
        } catch (error) {
          this.logger.warn?.(`[klines] ${adapter.id} ${unifiedSymbol} ${tf} failed: ${error.message}`);
        }
      }
      return [];
    });

    this.cache.set(key, data);
    return data;
  }

  async fetchKlinesByTf(unifiedSymbol, timeframes = TIMEFRAMES, limit = 300) {
    const rows = await Promise.all(timeframes.map((tf) => this.fetchKlines(unifiedSymbol, tf, limit)));
    return Object.fromEntries(timeframes.map((tf, idx) => [tf, rows[idx]]));
  }
}
