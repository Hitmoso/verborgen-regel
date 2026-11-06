import './styles.css';
import { getPuzzle } from './generator/generator';
import { items, properties } from './data/index';
import {
  newGame,
  testsLeft,
  runTest,
  startExam,
  setExamAnswer,
  submitExam,
  type GameState,
} from './game/game';
import { describe } from './rules/rule';
import { buildShareText } from './game/share';
import { toDateKey, msUntilNextPuzzle, isNewDay } from './lib/date';
import { loadGame, saveGame, recordCompletion, loadStreak, currentStreak } from './storage/storage';
import { TEST_BUDGET } from './config';
import { render, type ViewModel, type Actions } from './ui/render';

const root = document.getElementById('app') as HTMLElement;
const puzzle = getPuzzle(toDateKey(new Date()));
let state: GameState = loadGame(puzzle.dateKey) ?? newGame(puzzle, items);
let timer: number | undefined;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

function shareText(): string {
  const o = state.outcome;
  if (!o) return '';
  return buildShareText({
    puzzleNumber: puzzle.number,
    testsUsed: TEST_BUDGET - o.testsLeft,
    correct: o.correct,
    total: o.total,
  });
}

function view(): ViewModel {
  return {
    puzzleNumber: puzzle.number,
    state,
    items,
    testsLeft: testsLeft(state),
    ruleText: state.phase === 'done' ? describe(puzzle.rule, properties) : '',
    streak: currentStreak(loadStreak(), puzzle.dateKey),
    shareText: shareText(),
    countdown: formatCountdown(msUntilNextPuzzle(new Date())),
  };
}

/** Reload when the (normalised) day changed since load; true if reloading. */
function reloadIfNewDay(): boolean {
  if (!isNewDay(puzzle.dateKey, new Date())) return false;
  location.reload();
  return true;
}

function stopTimer(): void {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }
}

function draw(): void {
  stopTimer();
  render(root, view(), actions);
  if (state.phase === 'done') {
    timer = window.setInterval(() => {
      const ms = msUntilNextPuzzle(new Date());
      if (reloadIfNewDay() || ms <= 0) return;
      const e = document.getElementById('countdown');
      if (e) e.textContent = formatCountdown(ms);
    }, 1000);
  }
}

function update(next: GameState): void {
  if (reloadIfNewDay()) return;
  if (next === state) return;
  const wasDone = state.phase === 'done';
  state = next;
  saveGame(state);
  if (!wasDone && state.phase === 'done') recordCompletion(puzzle.dateKey);
  draw();
}

const actions: Actions = {
  test: (id) => update(runTest(state, puzzle, items, id)),
  startExam: () => update(startExam(state, puzzle, items)),
  answer: (id, v) => update(setExamAnswer(state, id, v)),
  submit: () => update(submitExam(state, puzzle, items)),
  async copy() {
    try {
      await navigator.clipboard.writeText(shareText());
      return true;
    } catch {
      return false;
    }
  },
};

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) reloadIfNewDay();
});
window.addEventListener('focus', () => {
  reloadIfNewDay();
});

draw();
