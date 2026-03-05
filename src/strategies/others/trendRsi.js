function sma(values, period) {
  if (values.length < period) {
    return null;
  }

  const recent = values.slice(-period);
  const sum = recent.reduce((acc, item) => acc + item, 0);
  return sum / period;
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function buildTps(direction, entry, sl) {
  const risk = Math.abs(entry - sl);
  if (direction === 'LONG') {
    return [
      { label: 'TP1', price: Number((entry + risk * 1.0).toFixed(4)) },
      { label: 'TP2', price: Number((entry + risk * 1.6).toFixed(4)) },
      { label: 'TP3', price: Number((entry + risk * 2.5).toFixed(4)) }
    ];
  }

  return [
    { label: 'TP1', price: Number((entry - risk * 1.0).toFixed(4)) },
    { label: 'TP2', price: Number((entry - risk * 1.6).toFixed(4)) },
    { label: 'TP3', price: Number((entry - risk * 2.5).toFixed(4)) }
  ];
}

export const trendRsiStrategy = {
  strategyId: 'trend_rsi_continuation',
  displayName: 'Trend RSI Continuation',
  supportedModes: ['FAST', 'MID', 'FULL'],
  supportedTimeframes: ['30m', '1h', '4h'],

  run(ctx) {
    const signals = [];

    for (const timeframe of ctx.timeframes) {
      const klines = ctx.klinesByTf[timeframe] || [];
      if (klines.length < 60) {
        continue;
      }

      const closes = klines.map((k) => k.close);
      const ma20 = sma(closes, 20);
      const ma50 = sma(closes, 50);
      const rsi14 = rsi(closes, 14);
      const last = closes.at(-1);

      if (!ma20 || !ma50 || !rsi14 || !last) {
        continue;
      }

      if (ma20 > ma50 && rsi14 > 52 && rsi14 < 72) {
        const entry = last;
        const sl = Math.min(...klines.slice(-10).map((k) => k.low));
        signals.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Trend + RSI Long',
          direction: 'LONG',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'MA20 above MA50 and RSI confirms momentum.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Recent swing low broken.' },
          takeProfits: buildTps('LONG', entry, sl),
          evidenceTags: ['TREND', 'RSI', 'MOMENTUM'],
          notes: [`RSI14=${rsi14.toFixed(2)}`]
        });
      }

      if (ma20 < ma50 && rsi14 < 48 && rsi14 > 28) {
        const entry = last;
        const sl = Math.max(...klines.slice(-10).map((k) => k.high));
        signals.push({
          ok: true,
          strategyId: this.strategyId,
          patternLabel: 'Trend + RSI Short',
          direction: 'SHORT',
          tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
          timeframe,
          entry: { kind: 'MARKET', price: entry, triggerText: 'MA20 below MA50 and RSI confirms downside.' },
          stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Recent swing high broken.' },
          takeProfits: buildTps('SHORT', entry, sl),
          evidenceTags: ['TREND', 'RSI', 'MOMENTUM'],
          notes: [`RSI14=${rsi14.toFixed(2)}`]
        });
      }
    }

    return signals;
  }
};
