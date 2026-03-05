export function mergeVolumeRows(exchangeRows) {
  const merged = new Map();

  exchangeRows.forEach((row) => {
    if (!row?.unifiedSymbol) {
      return;
    }

    const key = row.unifiedSymbol;
    const prev = merged.get(key) || {
      unifiedSymbol: key,
      volumeUsd: 0,
      exchanges: []
    };

    prev.volumeUsd += Number(row.volumeUsd || 0);
    prev.exchanges.push(row.exchangeId || 'unknown');
    merged.set(key, prev);
  });

  return Array.from(merged.values()).sort((a, b) => b.volumeUsd - a.volumeUsd);
}
