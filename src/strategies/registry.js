import { kumoPullbackStrategy } from './ichimoku/kumoPullback.js';
import { kumoBreakoutRetestStrategy } from './ichimoku/kumoBreakoutRetest.js';
import { harmonicDetectStrategy } from './harmonic/detect.js';
import { trendRsiStrategy } from './others/trendRsi.js';

export function buildStrategyRegistry() {
  return [
    kumoPullbackStrategy,
    kumoBreakoutRetestStrategy,
    harmonicDetectStrategy,
    trendRsiStrategy
  ];
}

export function runStrategies({ strategies, mode, ctx }) {
  const signals = [];

  strategies.forEach((strategy) => {
    if (!strategy.supportedModes.includes(mode)) {
      return;
    }

    const filteredTfs = ctx.timeframes.filter((tf) => strategy.supportedTimeframes.includes(tf));
    if (!filteredTfs.length) {
      return;
    }

    const results = strategy.run({ ...ctx, timeframes: filteredTfs, mode }) || [];
    results.forEach((signal) => {
      if (signal?.ok) {
        signals.push(signal);
      }
    });
  });

  return signals;
}
