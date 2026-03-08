import { stageTopSymbols, evaluateSymbolsStage } from './stages.js';

const STAGE1_SYMBOL_LIMIT = 100;
const STAGE2_SYMBOL_LIMIT = 60;
const STAGE3_SYMBOL_LIMIT = 20;

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
    const universeSymbols = pair ? [pair] : stageTopSymbols(universe, STAGE1_SYMBOL_LIMIT);
    return this.runPipeline({
      symbols: universeSymbols,
      timeframe,
      asOfUtc
    });
  }

  async runByExchange({ exchangeId, pair = null, timeframe = null, asOfUtc = new Date().toISOString() } = {}) {
    const universe = pair ? [] : await this.universeProvider.fetchTopByExchange(exchangeId, STAGE1_SYMBOL_LIMIT);
    const universeSymbols = pair ? [pair] : stageTopSymbols(universe, STAGE1_SYMBOL_LIMIT);
    return this.runPipeline({
      symbols: universeSymbols,
      timeframe,
      asOfUtc,
      exchangeId
    });
  }

  async runPipeline({ symbols, timeframe, asOfUtc, exchangeId = null }) {
    if (!symbols.length) {
      this.logger.info?.(
        `[scan] runner exchange=${exchangeId || 'merged'} stage1=0 stage2=0 stage3=0 qualified=0`
      );
      return { top3: [], candidates: [], noSetupReasons: ['Universe is empty.'] };
    }

    const stage1Symbols = symbols.slice(0, STAGE1_SYMBOL_LIMIT);
    const stage1 = await evaluateSymbolsStage({
      symbols: stage1Symbols,
      mode: 'FAST',
      timeframes: timeframe ? [timeframe] : undefined,
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage2Symbols = stage1.slice(0, STAGE2_SYMBOL_LIMIT).map((row) => row.symbol);
    const stage2 = await evaluateSymbolsStage({
      symbols: stage2Symbols,
      mode: 'MID',
      timeframes: timeframe ? [timeframe] : undefined,
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const stage3Symbols = stage2.slice(0, STAGE3_SYMBOL_LIMIT).map((row) => row.symbol);
    const stage3 = await evaluateSymbolsStage({
      symbols: stage3Symbols,
      mode: 'FULL',
      timeframes: timeframe ? [timeframe] : undefined,
      adapterIds: exchangeId ? [exchangeId] : null,
      klinesService: this.klinesService,
      scorer: this.scorer,
      strategies: this.strategies,
      asOfUtc
    });

    const qualified = stage3.filter((row) => row.scoring.scoreFinal >= this.env.manualScoreThreshold);

    const noSetupReasons = [];
    if (!qualified.length) {
      noSetupReasons.push(`No setup reached score >= ${this.env.manualScoreThreshold}.`);
      noSetupReasons.push(`Signals found on final stage: ${stage3.length}.`);
    }

    this.logger.info?.(
      `[scan] runner exchange=${exchangeId || 'merged'} stage1=${stage1.length} stage2=${stage2.length} stage3=${stage3.length} qualified=${qualified.length}`
    );

    return {
      top3: qualified.slice(0, 3),
      candidates: qualified,
      noSetupReasons,
      debug: {
        exchangeId,
        stage1Count: stage1.length,
        stage2Count: stage2.length,
        stage3Count: stage3.length
      }
    };
  }
}
