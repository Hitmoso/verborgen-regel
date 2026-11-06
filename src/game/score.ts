const POINTS_CORRECT = 10;
const PENALTY_WRONG = 10;
const POINTS_TEST_LEFT = 2;

export function computeScore(a: { correct: number; total: number; testsLeft: number }): number {
  const raw =
    POINTS_CORRECT * a.correct -
    PENALTY_WRONG * (a.total - a.correct) +
    POINTS_TEST_LEFT * a.testsLeft;
  return Math.max(0, raw);
}
