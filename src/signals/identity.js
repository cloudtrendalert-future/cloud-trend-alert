import { normalizeUnifiedSymbol } from '../exchanges/symbol/normalize.js';

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

export function canonicalizeCandidateIdentity(candidate) {
  const symbol = normalizeUnifiedSymbol(candidate?.symbol || '');
  const direction = normalizeDirection(candidate?.signal?.direction);
  const timeframe = normalizeTimeframe(candidate?.signal?.timeframe);

  const nextSignal = candidate?.signal
    ? {
        ...candidate.signal,
        direction: direction || candidate.signal.direction,
        timeframe: timeframe || candidate.signal.timeframe
      }
    : candidate?.signal;

  return {
    ...candidate,
    symbol: symbol || candidate?.symbol || '',
    signal: nextSignal
  };
}

export function buildSignalIdentity(candidate) {
  const canonical = canonicalizeCandidateIdentity(candidate);
  const symbol = canonical?.symbol || '';
  const direction = normalizeDirection(canonical?.signal?.direction);
  const timeframe = normalizeTimeframe(canonical?.signal?.timeframe);
  if (!symbol || !direction || !timeframe) {
    return '';
  }

  return `${symbol}|${direction}|${timeframe}`;
}

export function buildDedupeKey(signalIdentity) {
  return String(signalIdentity || '').trim();
}

