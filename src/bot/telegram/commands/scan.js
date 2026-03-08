import { noSetupCard } from '../../../cards/signals/noSetupCard.js';
import { isRenderableSignalCandidate, signalCard } from '../../../cards/signals/signalCard.js';
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

export function createScanCommand({ manualRunner, manualRecentSignalService, tradeMonitor, env, logger = console }) {
  return async (ctx) => {
    const lane = getLane(ctx);
    const { chatId, userId, groupTitle } = getChatContext(ctx);
    const asOfUtc = new Date().toISOString();
    let reservedIdentities = [];
    let sentCandidates = [];
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
      const rankedCandidates = merged.ranked.filter((candidate) => isRenderableSignalCandidate(candidate));
      const eligibility = await manualRecentSignalService.pickTopEligible(rankedCandidates, 3, { asOfUtc });
      const selectedEntries = eligibility.selected || [];
      reservedIdentities = selectedEntries.map((entry) => entry.signalIdentity).filter(Boolean);

      const skippedCooldownCount = eligibility.skipped.filter((item) => item.reason === 'cooldown').length;
      const skippedInFlightCount = eligibility.skipped.filter((item) => item.reason === 'in_flight').length;

      noSetupReasons = [
        `No setup reached score >= ${env.manualScoreThreshold} across Binance, Bybit, and Bitget.`,
        `Merged valid candidates: ${merged.mergedCount}.`,
        `After cross-exchange dedupe: ${merged.dedupedCount}.`,
        `Skipped by recent manual cooldown: ${skippedCooldownCount}.`,
        `Skipped by active manual request: ${skippedInFlightCount}.`
      ];

      logger.info?.(
        `[scan] aggregate lane=${lane} exchanges=${exchangeIds.join(',')} merged=${merged.mergedCount} deduped=${merged.dedupedCount} fresh=${selectedEntries.length} skipped_recent=${skippedCooldownCount}`
      );

      if (!selectedEntries.length) {
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

      for (const entry of selectedEntries) {
        const card = signalCard(entry.candidate);
        if (!card?.text) {
          manualRecentSignalService.releaseReservation(entry.signalIdentity);
          reservedIdentities = reservedIdentities.filter((identity) => identity !== entry.signalIdentity);
          continue;
        }

        await ctx.reply(card.text);
        await manualRecentSignalService.markSent(entry.signalIdentity, new Date().toISOString());
        reservedIdentities = reservedIdentities.filter((identity) => identity !== entry.signalIdentity);
        sentCandidates.push(entry.candidate);

        if (ctx.state.enablePerformance) {
          await tradeMonitor.onSignalIssued(entry.candidate);
        }
      }

      if (!sentCandidates.length) {
        const card = noSetupCard(noSetupReasons);
        await ctx.reply(card.text);
        logger.info?.('[scan] stage final_selected count=0 reason=no_renderable_cards');
        return;
      }

      if (lane === 'free') {
        logger.info?.(
          `[scan] outcome lane=free sent=${sentCandidates.length} exchanges=${exchangeIds.join(',')} chat=${chatId} user=${userId}`
        );
      } else if (lane === 'group') {
        logger.info?.(
          `[group] command=/scan outcome=sent cards=${sentCandidates.length} exchanges=${exchangeIds.join(',')} groupId=${chatId}`
        );
      } else {
        logger.info?.(
          `[premium] command=/scan outcome=sent cards=${sentCandidates.length} exchanges=${exchangeIds.join(',')} chat=${chatId} user=${userId}`
        );
      }
    } catch (error) {
      manualRecentSignalService.releaseReservations(reservedIdentities);
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
