import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../');

function loadDotEnv() {
  const dotEnvPath = path.resolve(projectRoot, '.env');
  if (!fs.existsSync(dotEnvPath)) {
    return;
  }

  const raw = fs.readFileSync(dotEnvPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const idx = trimmed.indexOf('=');
    if (idx <= 0) {
      return;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

function parseIntSafe(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((it) => it.trim())
    .filter(Boolean);
}

function parseCsvNumbers(value) {
  return parseCsv(value)
    .map((it) => Number.parseInt(it, 10))
    .filter((it) => Number.isFinite(it));
}

const dataDirRaw = process.env.DATA_DIR || './data';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  botToken: process.env.BOT_TOKEN || '',
  requiredChannelId: process.env.REQUIRED_CHANNEL_ID || '',
  requiredChannelUsername: process.env.REQUIRED_CHANNEL_USERNAME || '',
  adminIds: parseCsvNumbers(process.env.ADMIN_IDS || ''),
  premiumUserIds: parseCsvNumbers(process.env.PREMIUM_USER_IDS || ''),
  allowedGroupIds: parseCsvNumbers(process.env.ALLOWED_GROUP_IDS || ''),
  dataDir: path.isAbsolute(dataDirRaw) ? dataDirRaw : path.resolve(projectRoot, dataDirRaw),
  maxConcurrentScans: Math.max(1, parseIntSafe(process.env.MAX_CONCURRENT_SCANS, 2)),
  freeDailyQuota: Math.max(1, parseIntSafe(process.env.SCAN_FREE_DAILY_QUOTA, 3)),
  cooldownScanSeconds: Math.max(1, parseIntSafe(process.env.COOLDOWN_SCAN_SECONDS, 120)),
  cooldownScanPairSeconds: Math.max(1, parseIntSafe(process.env.COOLDOWN_SCAN_PAIR_SECONDS, 60)),
  cooldownScanPairTfSeconds: Math.max(1, parseIntSafe(process.env.COOLDOWN_SCAN_PAIR_TF_SECONDS, 30)),
  manualScoreThreshold: parseIntSafe(process.env.MANUAL_SCORE_THRESHOLD, 80),
  autoScoreThreshold: parseIntSafe(process.env.AUTO_SCORE_THRESHOLD, 85),
  autoMaxSendsPerDay: Math.max(1, parseIntSafe(process.env.AUTO_MAX_SENDS_PER_DAY, 5)),
  autoCrons: parseCsv(process.env.AUTO_CRONS || '5 0 * * *,5 4 * * *,5 8 * * *,5 12 * * *,5 16 * * *'),
  retentionDays: Math.max(1, parseIntSafe(process.env.RETENTION_DAYS, 60)),
  klinesCacheTtlSeconds: Math.max(10, parseIntSafe(process.env.KLINES_CACHE_TTL_SECONDS, 180)),
  marketdataTimeoutMs: Math.max(3000, parseIntSafe(process.env.MARKETDATA_TIMEOUT_MS, 12000)),
  logLevel: process.env.LOG_LEVEL || 'info'
};

export function validateEnv() {
  const errors = [];
  if (!env.botToken) {
    errors.push('BOT_TOKEN is required');
  }
  if (!env.requiredChannelId) {
    errors.push('REQUIRED_CHANNEL_ID is required');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
