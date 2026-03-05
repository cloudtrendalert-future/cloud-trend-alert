import { normalizeUnifiedSymbol, isUsdtSymbol } from '../symbol/normalize.js';

const BASE_URL = 'https://api.bybit.com';

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.retCode !== 0) {
      throw new Error(`Bybit error ${data.retCode}`);
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

function mapBybitInterval(tf) {
  if (tf === '30m') return '30';
  if (tf === '1h') return '60';
  if (tf === '4h') return '240';
  return '60';
}

function normalizeKline(row) {
  return {
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: Number(row[0])
  };
}

export class BybitUsdtPerpAdapter {
  constructor({ timeoutMs = 12000 } = {}) {
    this.id = 'bybit';
    this.timeoutMs = timeoutMs;
  }

  async fetchTopSymbols(limit = 100) {
    const result = await fetchJson(`${BASE_URL}/v5/market/tickers?category=linear`, this.timeoutMs);
    return (result.list || [])
      .map((row) => {
        const unifiedSymbol = normalizeUnifiedSymbol(row.symbol);
        return {
          exchangeId: this.id,
          unifiedSymbol,
          volumeUsd: Number(row.turnover24h || 0),
          meta: row
        };
      })
      .filter((row) => row.volumeUsd > 0 && isUsdtSymbol(row.unifiedSymbol))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, limit);
  }

  async fetchKlines(unifiedSymbol, tf, limit = 300) {
    const interval = mapBybitInterval(tf);
    const result = await fetchJson(
      `${BASE_URL}/v5/market/kline?category=linear&symbol=${encodeURIComponent(unifiedSymbol)}&interval=${interval}&limit=${limit}`,
      this.timeoutMs
    );

    return (result.list || []).map(normalizeKline).sort((a, b) => a.openTime - b.openTime);
  }
}
