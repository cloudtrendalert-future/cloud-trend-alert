import { renderCard, section } from '../base/layout.js';

export function quotaCard({ used, limit, remaining, dayUtc }) {
  return {
    text: renderCard({
      title: 'Daily Quota',
      sections: [
        section('FREE PLAN', [
          `Day (UTC): ${dayUtc}`,
          `Used: ${used}/${limit}`,
          `Remaining: ${remaining}`
        ])
      ]
    })
  };
}
