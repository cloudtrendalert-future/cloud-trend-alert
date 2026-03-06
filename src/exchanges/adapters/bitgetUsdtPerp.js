import { normalizeUnifiedSymbol, isUsdtSymbol } from '../symbol/normalize.js';

const BASE_URL = 'https://api.bitget.com';

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.code && data.code !== '00000') {
      throw new Error(`Bitget error ${data.code}`);
    }
    return data.data;
  } finally {
    clearTimeout(timer);
  }
}

function mapBitgetGranularity(tf) {
  if (tf === '30m') return '30m';
  if (tf === '1h') return '1H';
  if (tf === '4h') return '4H';
  return '1H';
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

export class BitgetUsdtPerpAdapter {
  constructor({ timeoutMs = 12000 } = {}) {
    this.id = 'bitget';
    this.timeoutMs = timeoutMs;
    this.universeReady = true;
    this.supportedSymbols = new Set();
  }

  canTradeSymbol(unifiedSymbol) {
    const normalized = normalizeUnifiedSymbol(unifiedSymbol);
    if (!normalized || !isUsdtSymbol(normalized)) {
      return false;
    }

    if (!this.supportedSymbols.size) {
      return true;
    }

    return this.supportedSymbols.has(normalized);
  }

  async fetchTopSymbols(limit = 100) {
    const rows = await fetchJson(`${BASE_URL}/api/v2/mix/market/tickers?productType=USDT-FUTURES`, this.timeoutMs);
    this.supportedSymbols = new Set((rows || [])
      .map((row) => normalizeUnifiedSymbol(row.symbol || row.baseCoin + 'USDT'))
      .filter((symbol) => isUsdtSymbol(symbol)));
    this.universeReady = true;

    return (rows || [])
      .map((row) => {
        const unifiedSymbol = normalizeUnifiedSymbol(row.symbol || row.baseCoin + 'USDT');
        return {
          exchangeId: this.id,
          unifiedSymbol,
          volumeUsd: Number(row.usdtVolume || row.quoteVolume || 0),
          meta: row
        };
      })
      .filter((row) => row.volumeUsd > 0 && isUsdtSymbol(row.unifiedSymbol))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, limit);
  }

  async fetchKlines(unifiedSymbol, tf, limit = 300) {
    const granularity = mapBitgetGranularity(tf);
    const end = Date.now();
    const start = end - 1000 * 60 * 60 * 24 * 30;

    const rows = await fetchJson(
      `${BASE_URL}/api/v2/mix/market/candles?symbol=${encodeURIComponent(unifiedSymbol)}&productType=USDT-FUTURES&granularity=${granularity}&startTime=${start}&endTime=${end}&limit=${limit}`,
      this.timeoutMs
    );

    return (rows || []).map(normalizeKline).sort((a, b) => a.openTime - b.openTime);
  }
}
