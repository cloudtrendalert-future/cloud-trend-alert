import { normalizeUnifiedSymbol, isUsdtSymbol } from '../symbol/normalize.js';

const BASE_URL = 'https://fapi.binance.com';

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeKline(row) {
  return {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[6])
  };
}

export class BinanceUsdmAdapter {
  constructor({ timeoutMs = 12000 } = {}) {
    this.id = 'binance';
    this.timeoutMs = timeoutMs;
  }

  async fetchTopSymbols(limit = 100) {
    const payload = await fetchJson(`${BASE_URL}/fapi/v1/ticker/24hr`, this.timeoutMs);
    return payload
      .map((row) => {
        const unifiedSymbol = normalizeUnifiedSymbol(row.symbol);
        return {
          exchangeId: this.id,
          unifiedSymbol,
          volumeUsd: Number(row.quoteVolume || 0),
          meta: row
        };
      })
      .filter((row) => row.volumeUsd > 0 && isUsdtSymbol(row.unifiedSymbol))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, limit);
  }

  async fetchKlines(unifiedSymbol, tf, limit = 300) {
    const interval = tf;
    const rows = await fetchJson(
      `${BASE_URL}/fapi/v1/klines?symbol=${encodeURIComponent(unifiedSymbol)}&interval=${interval}&limit=${limit}`,
      this.timeoutMs
    );

    return rows.map(normalizeKline);
  }
}
