import { isRenderableSignalCandidate, signalCard } from './signalCard.js';

export function manualTop3Card(top3 = [], _meta = {}) {
  return top3
    .filter((candidate) => isRenderableSignalCandidate(candidate))
    .map((candidate) => signalCard(candidate))
    .filter(Boolean);
}
