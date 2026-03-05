import { renderCard, section } from '../base/layout.js';
import { premiumStatsNavButtons } from '../base/nav.js';

export function statusOpenCard(openTrades) {
  const lines = openTrades.length
    ? openTrades.map((trade) => `${trade.symbol} | ${trade.direction} ${trade.timeframe} | ${trade.status}`)
    : ['No open monitors.'];

  return {
    text: renderCard({
      title: 'Open Monitors',
      sections: [section('OPEN', lines)]
    }),
    buttons: premiumStatsNavButtons()
  };
}
