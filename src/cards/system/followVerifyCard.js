import { renderCard, section } from '../base/layout.js';

export function followVerifyCard(channelUsername = '') {
  const link = channelUsername ? `https://t.me/${channelUsername}` : 'Required channel link is not configured.';

  return {
    text: renderCard({
      title: 'Follow + Verify Required',
      sections: [
        section('REQUIREMENT', [
          'Join the required channel and run Verify before using /scan.',
          `Channel: ${link}`
        ])
      ]
    }),
    buttons: [
      [{ text: 'Join Channel', url: link }],
      [{ text: 'Verify', callback_data: 'free:verify' }]
    ]
  };
}
