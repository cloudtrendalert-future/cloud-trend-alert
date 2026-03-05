import { normalizeUnifiedSymbol } from './normalize.js';

export function toUnified(symbol) {
  return normalizeUnifiedSymbol(symbol);
}

export function toAdapterSymbol(adapterId, unifiedSymbol) {
  const normalized = normalizeUnifiedSymbol(unifiedSymbol);
  if (!normalized) {
    return '';
  }

  if (adapterId === 'bitget') {
    return normalized;
  }

  return normalized;
}
