import { buildSignalIdentity, getCooldownStatus } from '../auto/dedupe.js';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MANUAL_COOLDOWN_MS = 6 * HOUR_MS;
const MANUAL_COOLDOWN_MS_BY_TIMEFRAME = Object.freeze({
  '1h': 6 * HOUR_MS,
  '4h': 12 * HOUR_MS
});

export function resolveManualCooldownMs(candidateOrTimeframe) {
  const timeframe = typeof candidateOrTimeframe === 'string'
    ? candidateOrTimeframe
    : candidateOrTimeframe?.signal?.timeframe;
  const normalized = String(timeframe || '').trim().toLowerCase();
  return MANUAL_COOLDOWN_MS_BY_TIMEFRAME[normalized] || DEFAULT_MANUAL_COOLDOWN_MS;
}

export class ManualRecentSignalService {
  constructor({ repo }) {
    this.repo = repo;
    this.pendingIdentities = new Set();
    this.selectionQueue = Promise.resolve();
  }

  async pickTopEligible(candidates = [], limit = 1, { asOfUtc = new Date().toISOString() } = {}) {
    const cappedLimit = Math.max(1, Number(limit) || 1);
    this.selectionQueue = this.selectionQueue
      .catch(() => undefined)
      .then(async () => {
        const skipped = [];
        const selected = [];
        const selectedIdentitySet = new Set();

        for (const candidate of candidates) {
          if (selected.length >= cappedLimit) {
            break;
          }

          const signalIdentity = buildSignalIdentity(candidate);
          if (!signalIdentity) {
            skipped.push({
              signalIdentity: '',
              reason: 'identity_missing',
              remainingMs: 0
            });
            continue;
          }

          if (selectedIdentitySet.has(signalIdentity)) {
            skipped.push({
              signalIdentity,
              reason: 'duplicate_ranked',
              remainingMs: 0
            });
            continue;
          }

          if (this.pendingIdentities.has(signalIdentity)) {
            skipped.push({
              signalIdentity,
              reason: 'in_flight',
              remainingMs: 0
            });
            continue;
          }

          const lastSentAtUtc = await this.repo.getLastSentAt(signalIdentity);
          const cooldownMs = resolveManualCooldownMs(candidate);
          const cooldownStatus = getCooldownStatus({
            lastSentAtUtc,
            cooldownMs,
            asOfUtc
          });

          if (cooldownStatus.inCooldown) {
            skipped.push({
              signalIdentity,
              reason: 'cooldown',
              remainingMs: cooldownStatus.remainingMs
            });
            continue;
          }

          this.pendingIdentities.add(signalIdentity);
          selectedIdentitySet.add(signalIdentity);
          selected.push({
            candidate,
            signalIdentity
          });
        }

        return {
          selected,
          skipped
        };
      });

    return this.selectionQueue;
  }

  async pickFirstEligible(candidates = [], { asOfUtc = new Date().toISOString() } = {}) {
    const result = await this.pickTopEligible(candidates, 1, { asOfUtc });
    const selected = result.selected?.[0] || null;
    return {
      candidate: selected?.candidate || null,
      signalIdentity: selected?.signalIdentity || '',
      skipped: result.skipped || []
    };
  }

  releaseReservation(signalIdentity) {
    if (!signalIdentity) {
      return;
    }
    this.pendingIdentities.delete(signalIdentity);
  }

  releaseReservations(signalIdentities = []) {
    (signalIdentities || []).forEach((identity) => {
      if (!identity) {
        return;
      }
      this.pendingIdentities.delete(identity);
    });
  }

  async markSent(signalIdentity, sentAtUtc = new Date().toISOString()) {
    if (!signalIdentity) {
      return;
    }

    try {
      await this.repo.setLastSentAt(signalIdentity, sentAtUtc);
    } finally {
      this.pendingIdentities.delete(signalIdentity);
    }
  }
}
