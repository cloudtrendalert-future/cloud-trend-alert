import { manualTop3Card } from '../../../cards/signals/manualTop3Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';
import { isRenderableSignalCandidate } from '../../../cards/signals/signalCard.js';

const FREE_SCAN_EXCHANGE_PRIORITY = Object.freeze(['binance', 'bitget', 'bybit']);

export function createScanCommand({ manualRunner, tradeMonitor, env }) {
  return async (ctx) => {
    const asOfUtc = new Date().toISOString();
    let validCandidates = [];
    let cards = [];
    let noSetupReasons = ['No valid signal payload was produced for this scan.'];

    if (ctx.state.isFree) {
      for (const exchangeId of FREE_SCAN_EXCHANGE_PRIORITY) {
        const result = await manualRunner.runByExchange({ exchangeId, asOfUtc });
        noSetupReasons = result.noSetupReasons.length
          ? result.noSetupReasons
          : noSetupReasons;
        const exchangeCandidates = result.top3.filter((candidate) => isRenderableSignalCandidate(candidate));
        if (exchangeCandidates.length < 3) {
          continue;
        }

        const exchangeCards = manualTop3Card(exchangeCandidates, {
          asOfUtc,
          threshold: env.manualScoreThreshold
        });

        if (exchangeCards.length < 3) {
          continue;
        }

        validCandidates = exchangeCandidates.slice(0, 3);
        cards = exchangeCards.slice(0, 3);
        break;
      }
    } else {
      const result = await manualRunner.run({ asOfUtc });
      noSetupReasons = result.noSetupReasons.length
        ? result.noSetupReasons
        : noSetupReasons;
      validCandidates = result.top3.filter((candidate) => isRenderableSignalCandidate(candidate));
      cards = manualTop3Card(validCandidates, {
        asOfUtc,
        threshold: env.manualScoreThreshold
      });
    }

    if (!cards.length) {
      const card = noSetupCard(noSetupReasons);
      await ctx.reply(card.text);
      return;
    }

    for (const card of cards) {
      await ctx.reply(card.text);
    }

    if (ctx.state.enablePerformance) {
      for (const candidate of validCandidates) {
        await tradeMonitor.onSignalIssued(candidate);
      }
    }
  };
}
