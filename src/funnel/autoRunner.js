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
    const stage1Symbols = stageTopSymbols(universe, 100);

    const stage1 = await evaluateSymbolsStage({
      symbols: stage1Symbols,
      mode: 'FAST',
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage2Symbols = stage1.slice(0, 50).map((row) => row.symbol);
    const stage2 = await evaluateSymbolsStage({
      symbols: stage2Symbols,
      mode: 'MID',
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage3Symbols = stage2.slice(0, 10).map((row) => row.symbol);
    const stage3 = await evaluateSymbolsStage({
      symbols: stage3Symbols,
      mode: 'FULL',
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const best = stage3.find((row) => row.scoring.scoreFinal > this.env.autoScoreThreshold) || null;
    return {
      top1: best,
      debug: {
        stage1Count: stage1.length,
        stage2Count: stage2.length,
        stage3Count: stage3.length
      }
    };
  }
}
