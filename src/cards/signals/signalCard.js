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

const NUMERIC_INPUT_REGEX = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function pow10(exp) {
  return BigInt(`1${'0'.repeat(exp)}`);
}

function expandExponential(rawText) {
  const text = String(rawText || '').trim().toLowerCase();
  if (!text || !text.includes('e')) {
    return text;
  }

  const [mantissaRaw, expRaw] = text.split('e');
  const exponent = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(exponent)) {
    return text;
  }

  const sign = mantissaRaw.startsWith('-') ? '-' : '';
  const mantissa = mantissaRaw.replace(/^[+-]/, '');
  const [intPartRaw = '0', fracPartRaw = ''] = mantissa.split('.');
  const digitsRaw = `${intPartRaw}${fracPartRaw}`;

  if (!digitsRaw || /^0+$/.test(digitsRaw)) {
    return '0';
  }

  const leadingZeroCount = (digitsRaw.match(/^0+/) || [''])[0].length;
  const digits = digitsRaw.slice(leadingZeroCount);
  const decimalIndex = intPartRaw.length - leadingZeroCount + exponent;

  if (decimalIndex <= 0) {
    return `${sign}0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  }

  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function normalizePlainNumeric(rawText, { keepTrailingZeros } = {}) {
  const text = String(rawText || '').trim();
  if (!text) {
    return null;
  }

  const sign = text.startsWith('-') ? '-' : '';
  const unsigned = text.replace(/^[+-]/, '');
  const [intRaw = '0', fracRaw = ''] = unsigned.split('.');
  const intPart = intRaw.replace(/^0+(?=\d)/, '') || '0';
  const fracPart = keepTrailingZeros ? fracRaw : fracRaw.replace(/0+$/, '');

  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  if (/^0(?:\.0+)?$/.test(body)) {
    return '0';
  }

  return `${sign}${body}`;
}

function toPlainNumericString(value, { keepTrailingZeros } = {}) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    // Round binary floating-point noise (e.g. 0.30000000000000004) while
    // preserving practical price precision.
    const sanitized = Number.parseFloat(value.toPrecision(15));
    const expanded = expandExponential(sanitized.toString());
    return normalizePlainNumeric(expanded, { keepTrailingZeros: false });
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || !NUMERIC_INPUT_REGEX.test(trimmed)) {
      return null;
    }

    const expanded = expandExponential(trimmed);
    return normalizePlainNumeric(expanded, {
      keepTrailingZeros: keepTrailingZeros !== false
    });
  }

  return null;
}

function toScaledInteger(value) {
  const numeric = toPlainNumericString(value, { keepTrailingZeros: true });
  if (!numeric) {
    return null;
  }

  const sign = numeric.startsWith('-') ? -1n : 1n;
  const unsigned = numeric.replace(/^[+-]/, '');
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, '') || '0';

  return {
    integer: BigInt(digits) * sign,
    scale: fracPart.length
  };
}

function scaledIntegerToText(integer, scale, { trimTrailingZeros = true } = {}) {
  const negative = integer < 0n;
  const absolute = negative ? -integer : integer;
  const padded = absolute.toString().padStart(scale + 1, '0');

  const intPart = scale > 0 ? padded.slice(0, -scale) : padded;
  const fracPart = scale > 0 ? padded.slice(-scale) : '';
  const body = fracPart ? `${intPart}.${fracPart}` : intPart;
  const normalized = normalizePlainNumeric(body, {
    keepTrailingZeros: !trimTrailingZeros
  }) || '0';

  if (normalized === '0') {
    return '0';
  }

  return negative ? `-${normalized}` : normalized;
}

function computeMidEntry(low, high) {
  const left = toScaledInteger(low);
  const right = toScaledInteger(high);
  if (!left || !right) {
    return null;
  }

  const scale = Math.max(left.scale, right.scale);
  const leftScaled = left.integer * pow10(scale - left.scale);
  const rightScaled = right.integer * pow10(scale - right.scale);
  const sum = leftScaled + rightScaled;

  if (sum % 2n === 0n) {
    return scaledIntegerToText(sum / 2n, scale);
  }

  return scaledIntegerToText(sum * 5n, scale + 1);
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

function priceText(value) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'N/A';
    }

    const numeric = toPlainNumericString(trimmed, { keepTrailingZeros: true });
    return numeric || trimmed;
  }

  const numeric = toPlainNumericString(value, { keepTrailingZeros: false });
  return numeric || 'N/A';
}

function resolveEntry(entry = {}) {
  const low = entry.zoneLow ?? entry.price ?? null;
  const high = entry.zoneHigh ?? entry.price ?? low;
  const mid = entry.midEntry ?? computeMidEntry(low, high) ?? entry.price ?? low;

  return {
    low: priceText(low),
    high: priceText(high),
    mid: priceText(mid)
  };
}

function tpValue(takeProfits = [], label, index) {
  const byLabel = takeProfits.find((tp) => String(tp?.label || '').toUpperCase() === label);
  const source = byLabel || takeProfits[index] || {};
  return priceText(source.price);
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
  const entry = resolveEntry(signal.entry);
  const macro = resolveMacroContext(candidate, signal);

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
      '🎯 Entry Zone:',
      `${entry.low} – ${entry.high}`,
      '⚖️ Mid Entry:',
      `${entry.mid}`,
      '',
      '🛑 Stop Loss:',
      `${priceText(signal?.stopLoss?.price)}`,
      '',
      '🎯 Take Profit:',
      `TP1: ${tpValue(signal.takeProfits, 'TP1', 0)} (25%)`,
      `TP2: ${tpValue(signal.takeProfits, 'TP2', 1)} (50%)`,
      `TP3: ${tpValue(signal.takeProfits, 'TP3', 2)} (100%)`,
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
