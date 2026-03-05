import { HARMONIC_PATTERNS, inRange } from './patterns.js';

function pickPivots(klines) {
  if (klines.length < 80) {
    return [];
  }

  const step = Math.floor(klines.length / 5);
  const picks = [
    klines[klines.length - step * 5],
    klines[klines.length - step * 4],
    klines[klines.length - step * 3],
    klines[klines.length - step * 2],
    klines[klines.length - step]
  ].filter(Boolean);

  return picks;
}

function ratio(a, b) {
  if (b === 0) {
    return 0;
  }
  return Math.abs(a / b);
}

function detectPattern(points) {
  if (points.length < 5) {
    return null;
  }

  const [x, a, b, c, d] = points.map((k) => k.close);
  const xa = a - x;
  const ab = b - a;
  const bc = c - b;
  const cd = d - c;

  for (const pattern of HARMONIC_PATTERNS) {
    if (
      inRange(ratio(ab, xa), pattern.rules.abXa) &&
      inRange(ratio(bc, ab), pattern.rules.bcAb) &&
      inRange(ratio(cd, bc), pattern.rules.cdBc)
    ) {
      const direction = d < c ? 'LONG' : 'SHORT';
      return {
        pattern,
        direction,
        pointD: d,
        xa,
        ab,
        bc,
        cd
      };
    }
  }

  return null;
}

function buildTps(direction, entry, risk) {
  if (direction === 'LONG') {
    return [
      { label: 'TP1', price: Number((entry + risk * 0.8).toFixed(4)) },
      { label: 'TP2', price: Number((entry + risk * 1.3).toFixed(4)) },
      { label: 'TP3', price: Number((entry + risk * 2.0).toFixed(4)) }
    ];
  }

  return [
    { label: 'TP1', price: Number((entry - risk * 0.8).toFixed(4)) },
    { label: 'TP2', price: Number((entry - risk * 1.3).toFixed(4)) },
    { label: 'TP3', price: Number((entry - risk * 2.0).toFixed(4)) }
  ];
}

export const harmonicDetectStrategy = {
  strategyId: 'harmonic_after_d_confirmed',
  displayName: 'Harmonic (After D Confirmed)',
  supportedModes: ['MID', 'FULL'],
  supportedTimeframes: ['1h', '4h'],

  run(ctx) {
    const signals = [];

    for (const timeframe of ctx.timeframes) {
      if (!this.supportedTimeframes.includes(timeframe)) {
        continue;
      }

      const klines = ctx.klinesByTf[timeframe] || [];
      const pivots = pickPivots(klines);
      const detected = detectPattern(pivots);
      if (!detected) {
        continue;
      }

      const last = klines.at(-1);
      if (!last) {
        continue;
      }

      const entry = last.close;
      const confirmDistance = Math.abs(entry - detected.pointD) / Math.max(1, Math.abs(detected.pointD));
      if (confirmDistance > 0.015) {
        continue;
      }

      const sl = detected.direction === 'LONG'
        ? detected.pointD * 0.985
        : detected.pointD * 1.015;
      const risk = Math.abs(entry - sl);

      signals.push({
        ok: true,
        strategyId: this.strategyId,
        patternLabel: `${detected.pattern.displayName} D Confirmed`,
        direction: detected.direction,
        tradeType: timeframe === '4h' ? 'SWING' : 'INTRADAY',
        timeframe,
        entry: { kind: 'MARKET', price: entry, triggerText: 'Point D confirmed within harmonic PRZ.' },
        stopLoss: { price: Number(sl.toFixed(4)), invalidationText: 'Price invalidates D reaction zone.' },
        takeProfits: buildTps(detected.direction, entry, risk),
        evidenceTags: ['HARMONIC', 'D_CONFIRMED'],
        notes: [
          `AB/XA=${ratio(detected.ab, detected.xa).toFixed(3)}`,
          `BC/AB=${ratio(detected.bc, detected.ab).toFixed(3)}`,
          `CD/BC=${ratio(detected.cd, detected.bc).toFixed(3)}`
        ]
      });
    }

    return signals;
  }
};
