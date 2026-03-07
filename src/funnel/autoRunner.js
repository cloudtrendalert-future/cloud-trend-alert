import { stageTopSymbols, evaluateSymbolsStage } from './stages.js';

export class AutoRunner {
  constructor({ universeProvider, klinesService, strategies, scorer, env }) {
    this.universeProvider = universeProvider;
    this.klinesService = klinesService;
    this.strategies = strategies;
    this.scorer = scorer;
    this.env = env;
  }

  async run({ asOfUtc = new Date().toISOString() } = {}) {
    const universe = await this.universeProvider.fetchMergedTop100();
    const symbols = stageTopSymbols(universe, 100);
    return this.runPipeline({ symbols, asOfUtc });
  }

  async runByExchange({ exchangeId, asOfUtc = new Date().toISOString() } = {}) {
    const universe = await this.universeProvider.fetchTopByExchange(exchangeId, 100);
    const symbols = stageTopSymbols(universe, 100);
    return this.runPipeline({
      symbols,
      asOfUtc,
      exchangeId
    });
  }

  async runPipeline({ symbols, asOfUtc, exchangeId = null }) {
    if (!symbols.length) {
      return {
        top1: null,
        candidates: [],
        debug: {
          exchangeId,
          stage1Count: 0,
          stage2Count: 0,
          stage3Count: 0
        }
      };
    }

    const stage1 = await evaluateSymbolsStage({
      symbols,
      mode: 'FAST',
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage2Symbols = stage1.slice(0, 50).map((row) => row.symbol);
    const stage2 = await evaluateSymbolsStage({
      symbols: stage2Symbols,
      mode: 'MID',
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage3Symbols = stage2.slice(0, 10).map((row) => row.symbol);
    const stage3 = await evaluateSymbolsStage({
      symbols: stage3Symbols,
      mode: 'FULL',
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const qualified = stage3.filter((row) => row.scoring.scoreFinal > this.env.autoScoreThreshold);
    const best = qualified[0] || null;
    return {
      top1: best,
      candidates: qualified,
      debug: {
        exchangeId,
        stage1Count: stage1.length,
        stage2Count: stage2.length,
        stage3Count: stage3.length
      }
    };
  }
}
