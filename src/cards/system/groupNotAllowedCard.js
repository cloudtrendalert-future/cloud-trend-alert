import { renderCard, section } from '../base/layout.js';

export function groupNotAllowedCard() {
  return {
    text: renderCard({
      title: 'Group Not Allowed',
      sections: [
        section('ACCESS', ['This group is not allowlisted. Leaving now.'])
      ]
    })
  };
}
