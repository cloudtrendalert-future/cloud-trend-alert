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

export function statusClosedCard({ dayUtc, closedTrades, summary }) {
  const list = closedTrades.length
    ? closedTrades.map((trade) => `${trade.symbol} | ${trade.direction} ${trade.timeframe} | maxTP ${trade.maxTPReached} | ${trade.status}`)
    : ['No closed records for this date.'];

  return {
    text: renderCard({
      title: `Closed Monitors ${dayUtc}`,
      sections: [
        section('LIST', list),
        section('OUTCOMES', outcomeLines(summary))
      ]
    }),
    buttons: premiumStatsNavButtons()
  };
}
