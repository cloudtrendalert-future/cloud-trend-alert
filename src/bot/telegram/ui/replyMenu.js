import { Markup } from 'telegraf';

export function freeReplyMenu() {
  return Markup.keyboard([
    ['Get AI Signal'],
    ['Join Channel', 'Verify'],
    ['Upgrade']
  ]).resize();
}

export function premiumReplyMenu() {
  return Markup.keyboard([
    ['/scan', '/scan BTCUSDT'],
    ['/scan BTCUSDT 1h'],
    ['/status', '/statusopen', '/statusclosed'],
    ['/cohort', '/info', '/profit']
  ]).resize();
}

export function removeReplyMenu() {
  return Markup.removeKeyboard();
}
