import { TEST_BUDGET } from '../config';

export function buildShareText(a: {
  puzzleNumber: number;
  testsUsed: number;
  correct: number;
  total: number;
}): string {
  const n = Number.isFinite(a.testsUsed) ? Math.round(a.testsUsed) : 0;
  const usedCount = Math.min(TEST_BUDGET, Math.max(0, n));
  const used = '🔍'.repeat(usedCount);
  const left = '⬜'.repeat(TEST_BUDGET - usedCount);
  const mark = a.correct === a.total ? '✅' : '❌';
  return `Regel #${a.puzzleNumber} ${used}${left} ${a.correct}/${a.total} ${mark}`;
}
