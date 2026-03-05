import { SCORE_WEIGHTS, STRATEGY_BASE, TIMEFRAME_BONUS } from './weights.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Scorer {
  score(ctx, signal) {
    const rejectReasons = [];

    if (!signal?.entry || !signal?.stopLoss || !signal?.takeProfits?.length) {
      rejectReasons.push('Signal missing entry/SL/TP');
    }

    const entryPrice = Number(signal.entry?.price || signal.entry?.zoneHigh || signal.entry?.zoneLow || 0);
    const sl = Number(signal.stopLoss?.price || 0);
    const tp1 = Number(signal.takeProfits?.[0]?.price || 0);

    if (!entryPrice || !sl || !tp1) {
      rejectReasons.push('Signal price fields invalid');
    }

    if (rejectReasons.length) {
      return {
        scoreFinal: 0,
        reasonTags: [],
        components: {},
        rejectReasons
      };
    }

    const risk = Math.abs(entryPrice - sl);
    const reward = Math.abs(tp1 - entryPrice);
    const rr = risk > 0 ? reward / risk : 0;

    const rrComponent = clamp((rr / 2.2) * SCORE_WEIGHTS.rr, 0, SCORE_WEIGHTS.rr);
    const evidenceComponent = clamp((signal.evidenceTags?.length || 0) * 3.5, 0, SCORE_WEIGHTS.evidence);
    const timeframeComponent = clamp(TIMEFRAME_BONUS[signal.timeframe] || 0, 0, SCORE_WEIGHTS.timeframe);
    const strategyBase = STRATEGY_BASE[signal.strategyId] || 70;
    const strategyComponent = clamp((strategyBase / 100) * SCORE_WEIGHTS.strategy, 0, SCORE_WEIGHTS.strategy);

    const qualityPenalty = [];
    if (signal.tradeType === 'INTRADAY' && signal.timeframe === '4h') {
      qualityPenalty.push('Trade type/timeframe mismatch');
    }

    const qualityComponent = clamp(SCORE_WEIGHTS.quality - qualityPenalty.length * 4, 0, SCORE_WEIGHTS.quality);

    const raw = rrComponent + evidenceComponent + timeframeComponent + strategyComponent + qualityComponent;
    const scoreFinal = clamp(Math.round(raw), 0, 100);

    const reasonTags = [
      `RR=${rr.toFixed(2)}`,
      `TF=${signal.timeframe}`,
      `STRATEGY=${signal.strategyId}`,
      ...(signal.evidenceTags || [])
    ];

    return {
      scoreFinal,
      reasonTags,
      components: {
        rrComponent,
        evidenceComponent,
        timeframeComponent,
        strategyComponent,
        qualityComponent
      },
      rejectReasons: qualityPenalty
    };
  }
}
