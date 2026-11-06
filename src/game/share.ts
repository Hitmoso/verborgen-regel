import { TEST_BUDGET } from '../config';

export function buildShareText(a: {
  puzzleNumber: number;
  testsUsed: number;
  correct: number;
  total: number;
}): string {
  const used = '🔍'.repeat(a.testsUsed);
  const left = '⬜'.repeat(TEST_BUDGET - a.testsUsed);
  const mark = a.correct === a.total ? '✅' : '❌';
  return `Regel #${a.puzzleNumber} ${used}${left} ${a.correct}/${a.total} ${mark}`;
}
