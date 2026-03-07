import { createHash } from 'node:crypto';
import { normalizeUnifiedSymbol } from '../exchanges/symbol/normalize.js';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 6 * HOUR_MS;
const COOLDOWN_MS_BY_TIMEFRAME = Object.freeze({
  '1h': 6 * HOUR_MS,
  '4h': 12 * HOUR_MS
});

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

export function resolveCooldownMs(candidate) {
  const timeframe = normalizeTimeframe(candidate?.signal?.timeframe);
  return COOLDOWN_MS_BY_TIMEFRAME[timeframe] || DEFAULT_COOLDOWN_MS;
}

export function getCooldownStatus({ lastSentAtUtc, cooldownMs, asOfUtc = new Date().toISOString() }) {
  if (!lastSentAtUtc) {
    return {
      inCooldown: false,
      remainingMs: 0
    };
  }

  const lastSentMs = Date.parse(lastSentAtUtc);
  const asOfMs = Date.parse(asOfUtc);
  if (!Number.isFinite(lastSentMs) || !Number.isFinite(asOfMs)) {
    return {
      inCooldown: false,
      remainingMs: 0
    };
  }

  const elapsedMs = asOfMs - lastSentMs;
  const remainingMs = Math.max(0, cooldownMs - elapsedMs);
  return {
    inCooldown: remainingMs > 0,
    remainingMs
  };
}
