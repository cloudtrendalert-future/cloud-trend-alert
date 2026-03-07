import { createHash } from 'node:crypto';
import { normalizeUnifiedSymbol } from '../exchanges/symbol/normalize.js';

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

function normalizeDirection(direction) {
  const value = String(direction || '').toUpperCase();
  if (value === 'SHORT') {
    return 'SHORT';
  }
  if (value === 'LONG') {
    return 'LONG';
  }
  return '';
}

function normalizeTimeframe(timeframe) {
  return String(timeframe || '').trim().toLowerCase();
}

export function buildSignalIdentity(candidate) {
  const symbol = normalizeUnifiedSymbol(candidate?.symbol || '');
  const direction = normalizeDirection(candidate?.signal?.direction);
  const timeframe = normalizeTimeframe(candidate?.signal?.timeframe);
  if (!symbol || !direction || !timeframe) {
    return '';
  }

  return `${symbol}|${direction}|${timeframe}`;
}

export function buildDedupeKey(signalIdentity) {
  return String(signalIdentity || '').trim();
}
