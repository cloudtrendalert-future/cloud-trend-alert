export function normalizeUnifiedSymbol(rawSymbol) {
  if (!rawSymbol) {
    return '';
  }

  return String(rawSymbol)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/USDTM$/, 'USDT')
    .replace(/PERP$/, '')
    .trim();
}

export function isUsdtSymbol(unifiedSymbol) {
  return unifiedSymbol.endsWith('USDT');
}
