export function premiumStatsNavButtons() {
  return [
    [
      { text: 'Signal', callback_data: 'nav:signal' },
      { text: 'Status', callback_data: 'nav:status' },
      { text: 'Cohort', callback_data: 'nav:cohort' },
      { text: 'Info', callback_data: 'nav:info' }
    ],
    [
      { text: 'Refresh', callback_data: 'nav:refresh' },
      { text: 'Close', callback_data: 'nav:close' }
    ]
  ];
}

export function wizardCancelButtons() {
  return [[{ text: 'Cancel', callback_data: 'wizard:cancel' }]];
}
