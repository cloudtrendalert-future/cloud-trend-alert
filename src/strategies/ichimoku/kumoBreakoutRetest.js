function cloudBounds(klines) {
  if (klines.length < 60) {
    return null;
  }

  const highs9 = klines.slice(-9).map((k) => k.high);
  const lows9 = klines.slice(-9).map((k) => k.low);
  const highs26 = klines.slice(-26).map((k) => k.high);
  const lows26 = klines.slice(-26).map((k) => k.low);
  const highs52 = klines.slice(-52).map((k) => k.high);
  const lows52 = klines.slice(-52).map((k) => k.low);

  const tenkan = (Math.max(...highs9) + Math.min(...lows9)) / 2;
  const kijun = (Math.max(...highs26) + Math.min(...lows26)) / 2;
  const spanA = (tenkan + kijun) / 2;
  const spanB = (Math.max(...highs52) + Math.min(...lows52)) / 2;

  return {
    top: Math.max(spanA, spanB),
    bottom: Math.min(spanA, spanB)
  };
}

function buildTps(direction, entry, risk) {
  if (direction === 'LONG') {
    return [
      { label: 'TP1', price: Number((entry + risk * 0.9).toFixed(4)) },
      { label: 'TP2', price: Number((entry + risk * 1.6).toFixed(4)) },
      { label: 'TP3', price: Number((entry + risk * 2.4).toFixed(4)) }
    ];
  }

  return [
    { label: 'TP1', price: Number((entry - risk * 0.9).toFixed(4)) },
    { label: 'TP2', price: Number((entry - risk * 1.6).toFixed(4)) },
    { label: 'TP3', price: Number((entry - risk * 2.4).toFixed(4)) }
  ];
}

export const kumoBreakoutRetestStrategy = {
  strategyId: 'ichimoku_kumo_breakout_retest',
  displayName: 'Ichimoku Kumo Breakout Retest',
  supportedModes: ['FAST', 'MID', 'FULL'],
  supportedTimeframes: ['30m', '1h', '4h'],

  run(ctx) {
    const signals = [];

    for (const timeframe of ctx.timeframes) {
      const klines = ctx.klinesByTf[timeframe] || [];
      const cloud = cloudBounds(klines);
      if (!cloud || klines.length < 65) {
        continue;
      }

      const last = klines.at(-1);
      const prev = klines.at(-2);
      const prev2 = klines.at(-3);

      if (!last || !prev || !prev2) {
        continue;
      }

      if (prev2.close <= cloud.top && prev.close > cloud.top && last.low <= cloud.top * 1.01 && last.close > cloud.top) {
        const entry = last.close;
        const sl = cloud.bottom * 0.995;
        const risk = Math.abs(entry - sl);
        signals.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Kumo Breakout Retest Long',
          direction: 'LONG',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'Breakout held above cloud after retest.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Breakdown below Kumo bottom invalidates long.' },
          takeProfits: buildTps('LONG', entry, risk),
          evidenceTags: ['ICHIMOKU', 'BREAKOUT', 'RETEST'],
          notes: []
        });
      }

      if (prev2.close >= cloud.bottom && prev.close < cloud.bottom && last.high >= cloud.bottom * 0.99 && last.close < cloud.bottom) {
        const entry = last.close;
        const sl = cloud.top * 1.005;
        const risk = Math.abs(entry - sl);
        signals.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Kumo Breakout Retest Short',
          direction: 'SHORT',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'Breakdown held below cloud after retest.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Recovery above Kumo top invalidates short.' },
          takeProfits: buildTps('SHORT', entry, risk),
          evidenceTags: ['ICHIMOKU', 'BREAKDOWN', 'RETEST'],
          notes: []
        });
      }
    }

    return signals;
  }
};
