import { renderCard, section } from '../base/layout.js';

export function premiumRequiredCard() {
  return {
    text: renderCard({
      title: 'Premium Required',
      sections: [
        section('ACCESS', [
          'This feature is available for Premium only.',
          'Use Upgrade from DM menu to unlock full commands.'
        ])
      ]
    })
  };
}
