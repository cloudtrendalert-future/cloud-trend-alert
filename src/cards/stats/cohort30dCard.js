import { renderCard, section } from '../base/layout.js';
import { premiumStatsNavButtons } from '../base/nav.js';

export function cohort30dCard({ startDayUtc, endDayUtc, summary }) {
  return {
    text: renderCard({
      title: 'Cohort Rolling 30D',
      sections: [
        section('WINDOW', [`${startDayUtc} -> ${endDayUtc}`]),
        section('OUTCOMES', [
          `PROGRESS: TP1 ${summary.tp1} | TP2 ${summary.tp2} | TP3 ${summary.tp3} | SL ${summary.sl}`,
          `OUTCOMES: HIT ${summary.hit} | SL HIT ${summary.lose}`,
          `Rates: Win ${summary.winRate}% | Lose ${summary.loseRate}%`,
          `Expired: ${summary.expired} (excluded from rates)`
        ])
      ]
    }),
    buttons: premiumStatsNavButtons()
  };
}
