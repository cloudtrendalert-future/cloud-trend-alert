export function classifyTradeOutcome(trade) {
  const max = trade.maxTPReached || 0;
  if (max === 3) return 'TP3';
  if (max === 2) return 'TP2';
  if (max === 1) return 'TP1';
  if (trade.slHitAtUtc) return 'SL';
  return 'NONE';
}

export function summarizeOutcomes(trades) {
  const summary = {
    tp1: 0,
    tp2: 0,
    tp3: 0,
    sl: 0,
    expired: 0,
    entries: trades.length,
    longCount: 0,
    shortCount: 0,
    hit: 0,
    lose: 0,
    winRate: 0,
    loseRate: 0
  };

  trades.forEach((trade) => {
    if (trade.direction === 'LONG') summary.longCount += 1;
    if (trade.direction === 'SHORT') summary.shortCount += 1;

    if (trade.status === 'EXPIRED_UNFILLED' || trade.status === 'EXPIRED_ACTIVE') {
      summary.expired += 1;
      return;
    }

    const bucket = classifyTradeOutcome(trade);
    if (bucket === 'TP1') summary.tp1 += 1;
    if (bucket === 'TP2') summary.tp2 += 1;
    if (bucket === 'TP3') summary.tp3 += 1;
    if (bucket === 'SL') summary.sl += 1;
  });

  summary.hit = summary.tp1 + summary.tp2 + summary.tp3;
  summary.lose = summary.sl;

  const denominator = summary.hit + summary.lose;
  if (denominator > 0) {
    summary.winRate = Number(((summary.hit / denominator) * 100).toFixed(2));
    summary.loseRate = Number(((summary.lose / denominator) * 100).toFixed(2));
  }

  return summary;
}
