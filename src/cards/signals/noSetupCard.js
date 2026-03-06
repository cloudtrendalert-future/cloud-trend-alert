export function noSetupCard(reasons = []) {
  void reasons;

  return {
    text: [
      '🤖 CLOUD TREND ALERT',
      '────────────────────',
      'No Setup Found',
      '',
      'No valid setup passed the current scan filters.',
      'Market structure is not strong enough for a qualified signal right now.',
      '',
      'Try scanning again later when conditions become clearer.',
      '',
      '⚠️ Not Financial Advice'
    ].join('\n')
  };
}
