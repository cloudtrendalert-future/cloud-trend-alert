export const HARMONIC_PATTERNS = [
  {
    id: 'gartley',
    displayName: 'Gartley',
    rules: {
      abXa: [0.55, 0.70],
      bcAb: [0.38, 0.88],
      cdBc: [1.10, 1.70]
    }
  },
  {
    id: 'bat',
    displayName: 'Bat',
    rules: {
      abXa: [0.35, 0.55],
      bcAb: [0.38, 0.88],
      cdBc: [1.60, 2.70]
    }
  }
];

export function inRange(value, range) {
  return value >= range[0] && value <= range[1];
}
