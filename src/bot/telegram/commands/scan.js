import { manualTop3Card } from '../../../cards/signals/manualTop3Card.js';
import { noSetupCard } from '../../../cards/signals/noSetupCard.js';
import { isRenderableSignalCandidate } from '../../../cards/signals/signalCard.js';
import { EXCHANGES } from '../../../config/constants.js';
import { mergeAndDedupeCandidates } from '../../../funnel/candidateMerge.js';

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
    let noSetupReasons = [];
    const exchangeIds = EXCHANGES;

    if (lane === 'free') {
      logger.info?.(`[scan] request received chat=${chatId} user=${userId} lane=free`);
    } else if (lane === 'group') {
      logger.info?.(`[group] command=/scan chat=${chatId} group="${groupTitle}" user=${userId}`);
    } else {
      logger.info?.(`[premium] command=/scan chat=${chatId} user=${userId} lane=premium`);
    }

    try {
      const mergedCandidates = [];
      for (const exchangeId of exchangeIds) {
        logger.info?.(`[scan] pass start lane=${lane} exchange=${exchangeId}`);
        const result = await manualRunner.runByExchange({ exchangeId, asOfUtc });
        const stage1Count = result.debug?.stage1Count ?? 0;
        const stage2Count = result.debug?.stage2Count ?? 0;
        const stage3Count = result.debug?.stage3Count ?? 0;
        const rawCandidates = Array.isArray(result.candidates) ? result.candidates : result.top3;
        const exchangeCandidates = rawCandidates.filter((candidate) => isRenderableSignalCandidate(candidate));
        mergedCandidates.push(...exchangeCandidates);
        logger.info?.(
          `[scan] pass done lane=${lane} exchange=${exchangeId} stage1=${stage1Count} stage2=${stage2Count} stage3=${stage3Count} qualified=${rawCandidates.length} renderable=${exchangeCandidates.length}`
        );
      }

      const merged = mergeAndDedupeCandidates(mergedCandidates);
      validCandidates = merged.ranked.slice(0, 3);
      cards = manualTop3Card(validCandidates, {
        asOfUtc,
        threshold: env.manualScoreThreshold
      }).slice(0, 3);
      noSetupReasons = [
        `No setup reached score >= ${env.manualScoreThreshold} across Binance, Bybit, and Bitget.`,
        `Merged valid candidates: ${merged.mergedCount}.`,
        `After cross-exchange dedupe: ${merged.dedupedCount}.`
      ];

      logger.info?.(
        `[scan] aggregate lane=${lane} exchanges=${exchangeIds.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} selected=${cards.length}`
      );

      if (!cards.length) {
        const card = noSetupCard(noSetupReasons);
        await ctx.reply(card.text);
        if (lane === 'free') {
          logger.info?.(
            `[scan] outcome lane=free no_setup exchanges=${exchangeIds.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} chat=${chatId} user=${userId}`
          );
        } else if (lane === 'group') {
          logger.info?.(
            `[group] command=/scan outcome=no_setup exchanges=${exchangeIds.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} groupId=${chatId}`
          );
        } else {
          logger.info?.(
            `[premium] command=/scan outcome=no_setup exchanges=${exchangeIds.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} chat=${chatId} user=${userId}`
          );
        }
        return;
      }

      for (const card of cards) {
        await ctx.reply(card.text);
      }

      if (lane === 'free') {
        logger.info?.(
          `[scan] outcome lane=free sent=${cards.length} exchanges=${exchangeIds.join(',')} chat=${chatId} user=${userId}`
        );
      } else if (lane === 'group') {
        logger.info?.(
          `[group] command=/scan outcome=sent cards=${cards.length} exchanges=${exchangeIds.join(',')} groupId=${chatId}`
        );
      } else {
        logger.info?.(
          `[premium] command=/scan outcome=sent cards=${cards.length} exchanges=${exchangeIds.join(',')} chat=${chatId} user=${userId}`
        );
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
