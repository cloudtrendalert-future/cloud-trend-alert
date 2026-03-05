import { FOOTER_NFA } from '../../config/constants.js';

export function section(title, lines = []) {
  return {
    title,
    lines: lines.filter(Boolean)
  };
}

export function renderCard({ title, sections = [], footer = FOOTER_NFA }) {
  const blocks = [`🤖 ${title}`, '──────────────────'];

  sections.forEach((item) => {
    blocks.push(item.title);
    item.lines.forEach((line) => blocks.push(line));
    blocks.push('');
  });

  blocks.push(footer);
  return blocks.join('\n').trim();
}

export function formatCandidateLine(rank, candidate) {
  const signal = candidate.signal;
  return `${rank}. ${candidate.symbol} | ${signal.direction} ${signal.timeframe} | Score ${candidate.scoring.scoreFinal}`;
}
