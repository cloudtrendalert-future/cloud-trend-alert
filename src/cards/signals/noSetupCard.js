import { renderCard, section } from '../base/layout.js';

export function noSetupCard(reasons = []) {
  return {
    text: renderCard({
      title: 'No Setup Found',
      sections: [
        section('MANUAL SCAN', [
          'No candidate passed the required filter for this request.',
          ...reasons.map((reason) => `- ${reason}`)
        ])
      ]
    })
  };
}
