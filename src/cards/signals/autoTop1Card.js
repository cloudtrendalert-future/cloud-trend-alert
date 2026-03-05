import { renderCard, section } from '../base/layout.js';

export function autoTop1Card(candidate) {
  const signal = candidate.signal;

  return {
    text: renderCard({
      title: 'AUTO Signal Top 1',
      sections: [
        section('SIGNAL', [
          `${candidate.symbol} | ${signal.direction} ${signal.timeframe} | Score ${candidate.scoring.scoreFinal}`,
          `${signal.patternLabel}`,
          `Entry: ${signal.entry.kind} ${signal.entry.price ? `@ ${signal.entry.price}` : signal.entry.triggerText}`,
          `SL: ${signal.stopLoss.price}`,
          `TP: ${signal.takeProfits.map((tp) => `${tp.label} ${tp.price}`).join(' | ')}`
        ]),
        section('NOTES', signal.notes || [])
      ]
    })
  };
}
