import { formatSignalPrices } from './priceFormatter.js';

function firstNonEmpty(values, fallback) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();
    if (text) {
      return text;
    }
  }

  return fallback;
}

function normalizeDirection(direction) {
  const value = String(direction || '').toUpperCase();
  if (value === 'SHORT') {
    return 'SHORT';
  }
  return 'LONG';
}

function directionTitle(direction) {
  return normalizeDirection(direction) === 'SHORT' ? '🔴 SHORT' : '🟢 LONG';
}

function modeLabel(signal) {
  const timeframe = String(signal?.timeframe || '').toLowerCase();
  if (timeframe === '1h') {
    return 'Intraday';
  }
  if (timeframe === '4h') {
    return 'Swing';
  }

  const tradeType = String(signal?.tradeType || '').toUpperCase();
  if (tradeType === 'SWING') {
    return 'Swing';
  }
  if (tradeType === 'INTRADAY') {
    return 'Intraday';
  }

  return 'Intraday';
}

function scoreValue(scoring = {}) {
  const value = Number(scoring.scoreFinal);
  if (!Number.isFinite(value)) {
    return 'N/A';
  }
  return String(Math.round(value));
}

function resolveMacroContext(candidate, signal) {
  const macro = candidate?.macroContext || signal?.macroContext || candidate?.context || {};

  return {
    btc: firstNonEmpty([
      macro.btc,
      macro.btcContext,
      signal?.btcContext,
      candidate?.btcContext
    ], 'N/A'),
    alts: firstNonEmpty([
      macro.alts,
      macro.altsContext,
      signal?.altsContext,
      candidate?.altsContext
    ], 'N/A'),
    bias: firstNonEmpty([
      macro.bias,
      signal?.bias,
      candidate?.bias
    ], 'NEUTRAL')
  };
}

export function isRenderableSignalCandidate(candidate) {
  const signal = candidate?.signal;
  return Boolean(
    candidate?.symbol
    && signal?.strategyId
    && signal?.direction
    && signal?.timeframe
    && signal?.entry
    && signal?.stopLoss
    && Array.isArray(signal?.takeProfits)
    && signal.takeProfits.length
  );
}

export function signalCard(candidate) {
  if (!isRenderableSignalCandidate(candidate)) {
    return null;
  }

  const signal = candidate.signal;
  const direction = normalizeDirection(signal.direction);
  const macro = resolveMacroContext(candidate, signal);
  const prices = formatSignalPrices(signal);

  const entryLines = prices.entry.isRange
    ? [
        '🎯 Entry Zone:',
        `${prices.entry.low} – ${prices.entry.high}`,
        '⚖️ Mid Entry:',
        `${prices.entry.mid}`
      ]
    : [
        '🎯 Entry:',
        `${prices.entry.single}`
      ];

  return {
    text: [
      '🤖 CLOUD TREND ALERT',
      '────────────────────',
      `🚀 FUTURES SIGNAL — ${directionTitle(direction)}`,
      '',
      `🪙 Pair: ${firstNonEmpty([candidate.symbol], 'N/A')}`,
      `Mode: ${modeLabel(signal)}`,
      `Signal TF: ${firstNonEmpty([signal.timeframe], 'N/A')}`,
      '',
      ...entryLines,
      '',
      '🛑 Stop Loss:',
      `${prices.stopLoss}`,
      '',
      '🎯 Take Profit:',
      `TP1: ${prices.takeProfits[0]?.price || 'N/A'} (25%)`,
      `TP2: ${prices.takeProfits[1]?.price || 'N/A'} (50%)`,
      `TP3: ${prices.takeProfits[2]?.price || 'N/A'} (100%)`,
      '',
      `📊 Score: ${scoreValue(candidate.scoring)} / 100`,
      '',
      '🌍 Macro Context:',
      `₿ BTC: ${macro.btc} | 🟡 ALTS: ${macro.alts}`,
      `⚡ Bias: ${macro.bias}`,
      '',
      '⚠️ Not Financial Advice'
    ].join('\n')
  };
}
