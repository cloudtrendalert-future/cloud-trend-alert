export const CONTEXT_DM = 'dm';
export const CONTEXT_GROUP = 'group';

export const TIMEFRAMES = ['30m', '1h', '4h'];
export const MODES = ['FAST', 'MID', 'FULL'];

export const TRADE_STATUS = {
  PENDING_ENTRY: 'PENDING_ENTRY',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  EXPIRED_UNFILLED: 'EXPIRED_UNFILLED',
  EXPIRED_ACTIVE: 'EXPIRED_ACTIVE'
};

export const DIRECTION = {
  LONG: 'LONG',
  SHORT: 'SHORT'
};

export const TRADE_TYPE = {
  INTRADAY: 'INTRADAY',
  SWING: 'SWING'
};

export const PLAN = {
  FREE: 'free',
  PREMIUM: 'premium'
};

export const EXCHANGES = ['binance', 'bybit', 'bitget'];

export const STRATEGY_MINIMUM_SIGNAL = Object.freeze({
  ok: false,
  strategyId: '',
  patternLabel: '',
  direction: 'LONG',
  tradeType: 'INTRADAY',
  timeframe: '1h',
  entry: { kind: 'MARKET', triggerText: '' },
  stopLoss: { price: 0, invalidationText: '' },
  takeProfits: [],
  evidenceTags: [],
  notes: []
});

export const FOOTER_NFA = '⚠️ Not Financial Advice';
