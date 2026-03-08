import { buildSignalIdentity, canonicalizeCandidateIdentity } from '../signals/identity.js';

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

export function mergeCandidates(candidates = []) {
  return Array.isArray(candidates)
    ? candidates.filter(Boolean)
    : [];
}

export function canonicalizeCandidates(candidates = []) {
  const merged = mergeCandidates(candidates);
  const canonicalized = merged.map((candidate) => canonicalizeCandidateIdentity(candidate));
  return {
    mergedCount: merged.length,
    canonicalizedCount: canonicalized.length,
    candidates: canonicalized
  };
}

export function dedupeCandidatesByIdentity(candidates = []) {
  const source = mergeCandidates(candidates);

  const dedupedByIdentity = new Map();
  const identityMissing = [];

  for (const candidate of source) {
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
    sourceCount: source.length,
    dedupedCount: deduped.length,
    identityMissingCount: identityMissing.length,
    candidates: deduped,
    ranked: rankCandidates(deduped)
  };
}

export function mergeAndDedupeCandidates(candidates = []) {
  const canonical = canonicalizeCandidates(candidates);
  const deduped = dedupeCandidatesByIdentity(canonical.candidates);
  return {
    mergedCount: canonical.mergedCount,
    canonicalizedCount: canonical.canonicalizedCount,
    dedupedCount: deduped.dedupedCount,
    identityMissingCount: deduped.identityMissingCount,
    ranked: deduped.ranked
  };
}
