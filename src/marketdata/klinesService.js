import { TIMEFRAMES } from '../config/constants.js';

export class KlinesService {
  constructor({ adapters, cache, limiter, logger = console }) {
    this.adapters = adapters;
    this.cache = cache;
    this.limiter = limiter;
    this.logger = logger;
  }

  cacheKey(unifiedSymbol, tf, limit, adapterIds = null) {
    const scope = Array.isArray(adapterIds) && adapterIds.length
      ? adapterIds.join('+')
      : 'any';
    return `${scope}:${unifiedSymbol}:${tf}:${limit}`;
  }

  async fetchKlines(unifiedSymbol, tf, limit = 300, { adapterIds = null } = {}) {
    if (!TIMEFRAMES.includes(tf)) {
      throw new Error(`Unsupported timeframe: ${tf}`);
    }

    const key = this.cacheKey(unifiedSymbol, tf, limit, adapterIds);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    const hasScopedAdapters = Array.isArray(adapterIds) && adapterIds.length > 0;
    const scopedIds = hasScopedAdapters ? new Set(adapterIds) : null;

    const data = await this.limiter.run(async () => {
      for (const adapter of this.adapters) {
        if (scopedIds && !scopedIds.has(adapter.id)) {
          continue;
        }

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

  async fetchKlinesByTf(unifiedSymbol, timeframes = TIMEFRAMES, limit = 300, { adapterIds = null } = {}) {
    const rows = await Promise.all(
      timeframes.map((tf) => this.fetchKlines(unifiedSymbol, tf, limit, { adapterIds }))
    );
    return Object.fromEntries(timeframes.map((tf, idx) => [tf, rows[idx]]));
  }
}
