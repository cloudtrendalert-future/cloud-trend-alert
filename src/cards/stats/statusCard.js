import { renderCard, section } from '../base/layout.js';
import { premiumStatsNavButtons } from '../base/nav.js';

function outcomeLines(summary) {
  return [
    `PROGRESS: TP1 ${summary.tp1} | TP2 ${summary.tp2} | TP3 ${summary.tp3} | SL ${summary.sl}`,
    `OUTCOMES: HIT ${summary.hit} | SL HIT ${summary.lose}`,
    `Rates: Win ${summary.winRate}% | Lose ${summary.loseRate}%`,
    `Expired: ${summary.expired} (excluded from rates)`
  ];
}

export function statusCard({ dayUtc, summary }) {
  return {
    text: renderCard({
      title: `Status Dashboard ${dayUtc}`,
      sections: [
        section('COUNTS', [
          `Entries: ${summary.entries}`,
          `Long: ${summary.longCount} | Short: ${summary.shortCount}`
        ]),
        section('OUTCOMES', outcomeLines(summary))
      ]
    }),
    buttons: premiumStatsNavButtons()
  };
}
