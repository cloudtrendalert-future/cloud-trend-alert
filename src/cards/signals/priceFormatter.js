const MIN_PRECISION = 2;
const MAX_PRECISION = 12;
const NUMERIC_INPUT_REGEX = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

    const sanitized = Number.parseFloat(value.toPrecision(15));
    return normalizePlainNumeric(expandExponential(sanitized.toString()), { keepTrailingZeros: false });
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || !NUMERIC_INPUT_REGEX.test(trimmed)) {
      return null;
    }

    return normalizePlainNumeric(expandExponential(trimmed), {
      keepTrailingZeros: keepTrailingZeros !== false
    });
  }

  return null;
}

function toNumericValue(value) {
  const plain = toPlainNumericString(value, { keepTrailingZeros: true });
  if (!plain) {
    return NaN;
  }

  const numeric = Number(plain);
  return Number.isFinite(numeric) ? numeric : NaN;
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

function formatFixed(value, precision) {
  const numeric = toNumericValue(value);
  if (!Number.isFinite(numeric)) {
    return 'N/A';
  }

  const step = 10 ** (-precision);
  const normalized = Math.abs(numeric) < step * 0.5 || Object.is(numeric, -0) ? 0 : numeric;
  return normalizePlainNumeric(normalized.toFixed(precision), { keepTrailingZeros: false }) || '0';
}

function resolveBasePrecision(referencePrice) {
  const abs = Math.abs(Number(referencePrice || 0));
  if (!Number.isFinite(abs) || abs === 0) {
    return 4;
  }
  if (abs >= 10000) return 2;
  if (abs >= 1000) return 3;
  if (abs >= 100) return 4;
  if (abs >= 1) return 5;
  if (abs >= 0.1) return 6;
  if (abs >= 0.01) return 7;
  if (abs >= 0.001) return 8;
  if (abs >= 0.0001) return 9;
  if (abs >= 0.00001) return 10;
  if (abs >= 0.000001) return 11;
  return 12;
}

function uniqueRawCount(values) {
  return new Set(values.map((value) => value.toPrecision(15))).size;
}

function preservesDistinct(values, precision) {
  if (values.length <= 1) {
    return true;
  }

  const rawDistinct = uniqueRawCount(values);
  if (rawDistinct <= 1) {
    return true;
  }

  const formattedDistinct = new Set(values.map((value) => formatFixed(value, precision))).size;
  return formattedDistinct >= rawDistinct;
}

function hasMaterialDifference(left, right) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  const delta = Math.abs(left - right);
  if (delta === 0) {
    return false;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return delta > Math.max(Number.EPSILON * scale * 8, 1e-12 * scale);
}

function hasMaterialEntryRange(entry) {
  return hasMaterialDifference(entry.low, entry.high);
}

function isRangeVisiblyDistinct(entry, precision) {
  if (!Number.isFinite(entry.low) || !Number.isFinite(entry.high)) {
    return false;
  }

  return formatFixed(entry.lowRaw, precision) !== formatFixed(entry.highRaw, precision);
}

function readEntry(signalEntry = {}) {
  const lowRaw = signalEntry.zoneLow ?? signalEntry.price ?? null;
  const highRaw = signalEntry.zoneHigh ?? signalEntry.price ?? signalEntry.zoneLow ?? null;
  const singleRaw = signalEntry.price ?? signalEntry.zoneLow ?? signalEntry.zoneHigh ?? null;
  const midpointRaw = signalEntry.midEntry ?? computeMidEntry(lowRaw, highRaw);
  const zoneLow = toNumericValue(lowRaw);
  const zoneHigh = toNumericValue(highRaw);
  const hasBoth = Number.isFinite(zoneLow) && Number.isFinite(zoneHigh);

  return {
    lowRaw,
    highRaw,
    singleRaw,
    midpointRaw,
    low: hasBoth ? Math.min(zoneLow, zoneHigh) : zoneLow,
    high: hasBoth ? Math.max(zoneLow, zoneHigh) : zoneHigh,
    single: toNumericValue(singleRaw),
    midpoint: toNumericValue(midpointRaw)
  };
}

function readTakeProfits(takeProfits = []) {
  const normalized = Array.isArray(takeProfits) ? takeProfits : [];

  return ['TP1', 'TP2', 'TP3'].map((label, index) => {
    const byLabel = normalized.find((tp) => String(tp?.label || '').toUpperCase() === label);
    const source = byLabel || normalized[index] || {};
    return {
      label,
      raw: source.price ?? null,
      numeric: toNumericValue(source.price)
    };
  });
}

function choosePrecision({ entry, stopLoss, takeProfits }) {
  const reference = [
    entry.single,
    entry.low,
    entry.high,
    entry.midpoint,
    stopLoss,
    ...takeProfits.map((tp) => tp.numeric)
  ].find((value) => Number.isFinite(value));

  let precision = clamp(resolveBasePrecision(reference), MIN_PRECISION, MAX_PRECISION);
  const tpValues = takeProfits
    .map((tp) => tp.numeric)
    .filter((value) => Number.isFinite(value));
  const needsEntryRangeVisibility = hasMaterialEntryRange(entry);

  while (precision < MAX_PRECISION) {
    const tpOk = preservesDistinct(tpValues, precision);
    const entryOk = !needsEntryRangeVisibility || isRangeVisiblyDistinct(entry, precision);
    if (tpOk && entryOk) {
      break;
    }
    precision += 1;
  }

  return precision;
}

function resolveEntryDisplay(entry, precision) {
  const hasRangeNumbers = Number.isFinite(entry.low) && Number.isFinite(entry.high);
  const lowText = hasRangeNumbers ? formatFixed(entry.lowRaw, precision) : 'N/A';
  const highText = hasRangeNumbers ? formatFixed(entry.highRaw, precision) : 'N/A';
  const hasMaterialRange = hasMaterialEntryRange(entry);
  const rangeVisiblyDistinct = hasRangeNumbers && lowText !== highText;

  if (hasMaterialRange && rangeVisiblyDistinct) {
    return {
      isRange: true,
      low: lowText,
      high: highText,
      mid: formatFixed(entry.midpointRaw, precision),
      single: ''
    };
  }

  const singleRaw = [
    entry.singleRaw,
    entry.lowRaw,
    entry.highRaw,
    entry.midpointRaw
  ].find((value) => toPlainNumericString(value, { keepTrailingZeros: true }) !== null);

  return {
    isRange: false,
    low: '',
    high: '',
    mid: '',
    single: singleRaw === undefined ? 'N/A' : formatFixed(singleRaw, precision)
  };
}

export function formatSignalPrices(signal = {}) {
  const entry = readEntry(signal.entry || {});
  const stopLossRaw = signal?.stopLoss?.price ?? null;
  const stopLoss = toNumericValue(stopLossRaw);
  const takeProfits = readTakeProfits(signal.takeProfits);
  const precision = choosePrecision({ entry, stopLoss, takeProfits });

  return {
    precision,
    entry: resolveEntryDisplay(entry, precision),
    stopLoss: Number.isFinite(stopLoss) ? formatFixed(stopLossRaw, precision) : 'N/A',
    takeProfits: takeProfits.map((tp) => ({
      label: tp.label,
      price: Number.isFinite(tp.numeric) ? formatFixed(tp.raw, precision) : 'N/A'
    }))
  };
}
