import { renderCard, section, formatCandidateLine } from '../base/layout.js';

function detailLines(candidate) {
  const signal = candidate.signal;
  return [
    `${signal.patternLabel}`,
    `Entry: ${signal.entry.kind} ${signal.entry.price ? `@ ${signal.entry.price}` : signal.entry.triggerText}`,
    `SL: ${signal.stopLoss.price}`,
    `TP: ${signal.takeProfits.map((tp) => `${tp.label} ${tp.price}`).join(' | ')}`
  ];
}

export function manualTop3Card(top3, meta = {}) {
  const lines = top3.flatMap((candidate, index) => {
    return [
      formatCandidateLine(index + 1, candidate),
      ...detailLines(candidate),
      ''
    ];
  });

  return {
    text: renderCard({
      title: 'Manual Scan Top 3',
      sections: [
        section('RESULTS', lines),
        section('CONTEXT', [
          `As Of (UTC): ${meta.asOfUtc || new Date().toISOString()}`,
          `Threshold: Score >= ${meta.threshold || 80}`
        ])
      ]
    })
  };
}
