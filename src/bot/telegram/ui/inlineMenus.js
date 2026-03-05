export function premiumHomeInline() {
  return [
    [
      { text: 'Signal', callback_data: 'menu:signal' },
      { text: 'Status', callback_data: 'menu:status' }
    ],
    [
      { text: 'Cohort', callback_data: 'menu:cohort' },
      { text: 'Info', callback_data: 'menu:info' }
    ],
    [
      { text: 'Profit Simulator', callback_data: 'menu:profit' },
      { text: 'Close', callback_data: 'nav:close' }
    ]
  ];
}

export function freeInline() {
  return [
    [{ text: 'Get AI Signal', callback_data: 'menu:signal' }],
    [{ text: 'Verify', callback_data: 'free:verify' }]
  ];
}
