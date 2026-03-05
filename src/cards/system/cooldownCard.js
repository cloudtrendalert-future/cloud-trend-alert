import { renderCard, section } from '../base/layout.js';

export function cooldownCard({ action, remainingSeconds }) {
  return {
    text: renderCard({
      title: 'Cooldown Active',
      sections: [
        section('WAIT', [
          `Action: ${action}`,
          `Try again in ${remainingSeconds}s.`
        ])
      ]
    })
  };
}
