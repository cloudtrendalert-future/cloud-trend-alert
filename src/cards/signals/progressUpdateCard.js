import { renderCard, section } from '../base/layout.js';

export function progressUpdateCard({ symbol, event, direction, timeframe, message }) {
  return {
    text: renderCard({
      title: `Progress Update ${symbol}`,
      sections: [
        section('EVENT', [
          `Type: ${event}`,
          `Direction: ${direction}`,
          `Timeframe: ${timeframe}`,
          message || ''
        ])
      ]
    })
  };
}
