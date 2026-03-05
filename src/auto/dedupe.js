import { createHash } from 'node:crypto';

export function buildSignalHash(candidate) {
  const signal = candidate?.signal;
  const base = [
    candidate?.symbol || '',
    signal?.strategyId || '',
    signal?.patternLabel || '',
    signal?.direction || '',
    signal?.timeframe || '',
    signal?.entry?.price || signal?.entry?.triggerText || ''
  ].join('|');

  return createHash('sha1').update(base).digest('hex').slice(0, 16);
}

export function buildDedupeKey(dayUtc, symbol, signalHash) {
  return `${dayUtc}:${symbol}:${signalHash}`;
}
