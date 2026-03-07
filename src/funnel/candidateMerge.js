import { buildSignalIdentity } from '../auto/dedupe.js';

function toScore(candidate) {
  const value = Number(candidate?.scoring?.scoreFinal);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function compareCandidatesByScoreDesc(left, right) {
  return toScore(right) - toScore(left);
}

export function rankCandidates(candidates = []) {
  return [...candidates].sort(compareCandidatesByScoreDesc);
}

export function mergeAndDedupeCandidates(candidates = []) {
  const merged = Array.isArray(candidates)
    ? candidates.filter(Boolean)
    : [];

  const dedupedByIdentity = new Map();
  const identityMissing = [];

  for (const candidate of merged) {
    const identity = buildSignalIdentity(candidate);
    if (!identity) {
      identityMissing.push(candidate);
      continue;
    }

    const previous = dedupedByIdentity.get(identity);
    if (!previous || toScore(candidate) > toScore(previous)) {
      dedupedByIdentity.set(identity, candidate);
    }
  }

  const deduped = [
    ...dedupedByIdentity.values(),
    ...identityMissing
  ];

  return {
    mergedCount: merged.length,
    dedupedCount: deduped.length,
    ranked: rankCandidates(deduped)
  };
}
