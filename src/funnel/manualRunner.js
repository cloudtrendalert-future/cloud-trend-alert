import { stageTopSymbols, evaluateSymbolsStage } from './stages.js';

export class ManualRunner {
  constructor({ universeProvider, klinesService, strategies, scorer, env, logger = console }) {
    this.universeProvider = universeProvider;
    this.klinesService = klinesService;
    this.strategies = strategies;
    this.scorer = scorer;
    this.env = env;
    this.logger = logger;
  }

  async run({ pair = null, timeframe = null, asOfUtc = new Date().toISOString() } = {}) {
    const universe = await this.universeProvider.fetchMergedTop100();
    const universeSymbols = pair ? [pair] : stageTopSymbols(universe, 100);

    if (!universeSymbols.length) {
      return { top3: [], noSetupReasons: ['Universe is empty.'] };
    }

    const stage1Symbols = universeSymbols.slice(0, 100);
    const stage1 = await evaluateSymbolsStage({
      symbols: stage1Symbols,
      mode: 'FAST',
      timeframes: timeframe ? [timeframe] : undefined,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage2Symbols = stage1.slice(0, 50).map((row) => row.symbol);
    const stage2 = await evaluateSymbolsStage({
      symbols: stage2Symbols,
      mode: 'MID',
      timeframes: timeframe ? [timeframe] : undefined,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage3Symbols = stage2.slice(0, 10).map((row) => row.symbol);
    const stage3 = await evaluateSymbolsStage({
      symbols: stage3Symbols,
      mode: 'FULL',
      timeframes: timeframe ? [timeframe] : undefined,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const qualified = stage3.filter((row) => row.scoring.scoreFinal >= this.env.manualScoreThreshold).slice(0, 3);

    const noSetupReasons = [];
    if (!qualified.length) {
      noSetupReasons.push(`No setup reached score >= ${this.env.manualScoreThreshold}.`);
      noSetupReasons.push(`Signals found on final stage: ${stage3.length}.`);
    }

    return {
      top3: qualified,
      noSetupReasons,
      debug: {
        stage1Count: stage1.length,
        stage2Count: stage2.length,
        stage3Count: stage3.length
      }
    };
  }
}
