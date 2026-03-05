import { renderCard, section } from '../base/layout.js';

export function pairTfTop1Card(candidate, pair, timeframe) {
  const signal = candidate.signal;

  return {
    text: renderCard({
      title: `Pair+TF Scan ${pair} ${timeframe}`,
      sections: [
        section('BEST PLAN', [
          `${candidate.symbol} | ${signal.direction} ${signal.timeframe} | Score ${candidate.scoring.scoreFinal}`,
          `${signal.patternLabel}`,
          `Entry: ${signal.entry.kind} ${signal.entry.price ? `@ ${signal.entry.price}` : signal.entry.triggerText}`,
          `SL: ${signal.stopLoss.price}`,
          `TP: ${signal.takeProfits.map((tp) => `${tp.label} ${tp.price}`).join(' | ')}`
        ])
      ]
    })
  };
}
