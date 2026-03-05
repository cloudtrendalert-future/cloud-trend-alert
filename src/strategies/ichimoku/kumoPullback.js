function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calcIchimoku(klines) {
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
  const spanA = avg([tenkan, kijun]);
  const spanB = (Math.max(...highs52) + Math.min(...lows52)) / 2;

  return { tenkan, kijun, spanA, spanB };
}

function buildTps(direction, entry, sl) {
  const risk = Math.abs(entry - sl);
  if (!risk || !Number.isFinite(risk)) {
    return [];
  }

  if (direction === 'LONG') {
    return [
      { label: 'TP1', price: Number((entry + risk).toFixed(4)) },
      { label: 'TP2', price: Number((entry + risk * 1.8).toFixed(4)) },
      { label: 'TP3', price: Number((entry + risk * 2.8).toFixed(4)) }
    ];
  }

  return [
    { label: 'TP1', price: Number((entry - risk).toFixed(4)) },
    { label: 'TP2', price: Number((entry - risk * 1.8).toFixed(4)) },
    { label: 'TP3', price: Number((entry - risk * 2.8).toFixed(4)) }
  ];
}

export const kumoPullbackStrategy = {
  strategyId: 'ichimoku_kumo_pullback',
  displayName: 'Ichimoku Kumo Pullback',
  supportedModes: ['FAST', 'MID', 'FULL'],
  supportedTimeframes: ['30m', '1h', '4h'],

  run(ctx) {
    const out = [];

    for (const timeframe of ctx.timeframes) {
      const klines = ctx.klinesByTf[timeframe] || [];
      const ichimoku = calcIchimoku(klines);
      if (!ichimoku) {
        continue;
      }

      const last = klines.at(-1);
      const prev = klines.at(-2);
      if (!last || !prev) {
        continue;
      }

      const cloudTop = Math.max(ichimoku.spanA, ichimoku.spanB);
      const cloudBottom = Math.min(ichimoku.spanA, ichimoku.spanB);

      if (last.close > cloudTop && prev.low <= cloudTop * 1.01) {
        const entry = last.close;
        const sl = Math.min(ichimoku.kijun, cloudBottom) * 0.995;
        out.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Kumo Pullback Long',
          direction: 'LONG',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'Price reclaimed cloud top with pullback.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Close back below Kumo base invalidates setup.' },
          takeProfits: buildTps('LONG', entry, sl),
          evidenceTags: ['ICHIMOKU', 'TREND', 'PULLBACK'],
          notes: [`Tenkan=${ichimoku.tenkan.toFixed(4)}`, `Kijun=${ichimoku.kijun.toFixed(4)}`]
        });
      }

      if (last.close < cloudBottom && prev.high >= cloudBottom * 0.99) {
        const entry = last.close;
        const sl = Math.max(ichimoku.kijun, cloudTop) * 1.005;
        out.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Kumo Pullback Short',
          direction: 'SHORT',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'Price rejected cloud bottom on pullback.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Close above Kumo top invalidates setup.' },
          takeProfits: buildTps('SHORT', entry, sl),
          evidenceTags: ['ICHIMOKU', 'TREND', 'PULLBACK'],
          notes: [`Tenkan=${ichimoku.tenkan.toFixed(4)}`, `Kijun=${ichimoku.kijun.toFixed(4)}`]
        });
      }
    }

    return out;
  }
};
