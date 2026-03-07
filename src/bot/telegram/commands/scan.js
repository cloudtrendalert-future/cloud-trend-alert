import { manualTop3Card } from '../../../cards/signals/manualTop3Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';
import { isRenderableSignalCandidate } from '../../../cards/signals/signalCard.js';

const FREE_SCAN_EXCHANGE_PRIORITY = Object.freeze(['binance', 'bitget', 'bybit']);

function getLane(ctx) {
  if (ctx.chat?.type !== 'private') {
    return 'group';
  }
  return ctx.state.isFree ? 'free' : 'premium';
}

function getChatContext(ctx) {
  const chatId = Number(ctx.chat?.id || 0);
  const userId = Number(ctx.from?.id || 0);
  const groupTitle = String(ctx.chat?.title || '').replaceAll('"', '\'');
  return { chatId, userId, groupTitle };
}

export function createScanCommand({ manualRunner, tradeMonitor, env, logger = console }) {
  return async (ctx) => {
    const lane = getLane(ctx);
    const { chatId, userId, groupTitle } = getChatContext(ctx);
    const asOfUtc = new Date().toISOString();
    let validCandidates = [];
    let cards = [];
    let noSetupReasons = ['No valid signal payload was produced for this scan.'];
    let selectedExchangeId = 'merged';

    if (lane === 'free') {
      logger.info?.(`[scan] request received chat=${chatId} user=${userId} lane=free`);
    } else if (lane === 'group') {
      logger.info?.(`[group] command=/scan chat=${chatId} group="${groupTitle}" user=${userId}`);
    } else {
      logger.info?.(`[premium] command=/scan chat=${chatId} user=${userId} lane=premium`);
    }

    try {
      if (ctx.state.isFree) {
        for (const exchangeId of FREE_SCAN_EXCHANGE_PRIORITY) {
          logger.info?.(`[scan] trying exchange=${exchangeId}`);
          const result = await manualRunner.runByExchange({ exchangeId, asOfUtc });
          noSetupReasons = result.noSetupReasons.length
            ? result.noSetupReasons
            : noSetupReasons;
          const exchangeCandidates = result.top3.filter((candidate) => isRenderableSignalCandidate(candidate));
          if (exchangeCandidates.length < 3) {
            logger.info?.(`[scan] exchange=${exchangeId} no valid top3`);
            continue;
          }

          const exchangeCards = manualTop3Card(exchangeCandidates, {
            asOfUtc,
            threshold: env.manualScoreThreshold
          });

          if (exchangeCards.length < 3) {
            logger.info?.(`[scan] exchange=${exchangeId} no valid top3`);
            continue;
          }

          logger.info?.(`[scan] exchange=${exchangeId} selected top3=${exchangeCandidates.length}`);
          selectedExchangeId = exchangeId;
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
        if (lane === 'free') {
          logger.info?.(`[scan] no setup chat=${chatId} user=${userId}`);
        } else if (lane === 'group') {
          logger.info?.(`[group] command=/scan no setup groupId=${chatId}`);
        } else {
          logger.info?.(`[premium] command=/scan no setup chat=${chatId} user=${userId}`);
        }
        return;
      }

      for (const card of cards) {
        await ctx.reply(card.text);
      }

      if (lane === 'free') {
        logger.info?.(`[scan] sent cards=${cards.length} exchange=${selectedExchangeId} chat=${chatId} user=${userId}`);
      } else if (lane === 'group') {
        logger.info?.(`[group] delivery sent cards=${cards.length} groupId=${chatId}`);
      } else {
        logger.info?.(`[premium] command=/scan success cards=${cards.length} chat=${chatId} user=${userId}`);
      }

      if (ctx.state.enablePerformance) {
        for (const candidate of validCandidates) {
          await tradeMonitor.onSignalIssued(candidate);
        }
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      if (lane === 'free') {
        logger.error?.(`[scan] request failed chat=${chatId} user=${userId} error=${errorMessage}`);
      } else if (lane === 'group') {
        logger.error?.(`[group] command=/scan failed groupId=${chatId} error=${errorMessage}`);
      } else {
        logger.error?.(`[premium] command=/scan failed chat=${chatId} user=${userId} error=${errorMessage}`);
      }
      throw error;
    }
  };
}
