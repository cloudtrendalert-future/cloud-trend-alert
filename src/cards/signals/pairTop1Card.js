import { renderCard, section } from '../base/layout.js';

export function pairTop1Card(candidate, pair) {
  const signal = candidate.signal;

  return {
    text: renderCard({
      title: `Pair Scan ${pair}`,
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
