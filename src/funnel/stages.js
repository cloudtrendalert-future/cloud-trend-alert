import { TIMEFRAMES } from '../config/constants.js';
import { runStrategies } from '../strategies/registry.js';

export function stageTopSymbols(universeRows, limit) {
  return universeRows.slice(0, limit).map((row) => row.unifiedSymbol);
}

export async function evaluateSymbolsStage({
  symbols,
  mode,
  timeframes = TIMEFRAMES,
  adapterIds = null,
  klinesService,
  scorer,
  strategies,
  asOfUtc
}) {
  const results = [];

  for (const symbol of symbols) {
    const klinesByTf = await klinesService.fetchKlinesByTf(
      symbol,
      timeframes,
      300,
      { adapterIds }
    );
    const hasEnoughData = timeframes.every((tf) => (klinesByTf[tf] || []).length >= 40);
    if (!hasEnoughData) {
      continue;
    }

    const ctx = {
      symbol,
      mode,
      timeframes,
      klinesByTf,
      asOfUtc,
      derived: {}
    };

    const signals = runStrategies({ strategies, mode, ctx });
    if (!signals.length) {
      continue;
    }

    const scored = signals.map((signal) => ({
      signal,
      scoring: scorer.score(ctx, signal)
    }));

    const best = scored
      .filter((item) => item.scoring.scoreFinal > 0)
      .sort((a, b) => b.scoring.scoreFinal - a.scoring.scoreFinal)[0];

    if (best) {
      results.push({
        symbol,
        signal: best.signal,
        scoring: best.scoring
      });
    }
  }

  return results.sort((a, b) => b.scoring.scoreFinal - a.scoring.scoreFinal);
}
