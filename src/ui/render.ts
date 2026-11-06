import type { Item } from '../types';
import type { GameState } from '../game/game';
import { TEST_BUDGET, EXAM_SIZE } from '../config';
import { TEXT } from './text';

export type ViewModel = {
  puzzleNumber: number;
  state: GameState;
  items: Item[];
  testsLeft: number;
  ruleText: string;
  streak: number;
  shareText: string;
  countdown: string;
};

export type Actions = {
  test(itemId: string): void;
  startExam(): void;
  answer(itemId: string, value: boolean): void;
  submit(): void;
  copy(): Promise<boolean>;
};

// Search query lives here so it survives full re-renders.
let query = '';

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { cls?: string; text?: string; attrs?: Record<string, string> } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (opts.cls) e.className = opts.cls;
  if (opts.text !== undefined) e.textContent = opts.text;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) e.setAttribute(k, v);
  for (const c of children) e.append(c);
  return e;
}

function itemLabel(item: Item | undefined, id: string): string {
  return item ? `${item.emoji} ${item.name}` : id;
}

function chip(item: Item | undefined, id: string, extra = ''): HTMLElement {
  return el('li', { cls: 'chip ' + extra, text: itemLabel(item, id) });
}

function column(title: string, cls: string, ids: string[], byId: Map<string, Item>): HTMLElement {
  const ul = el('ul', { cls: 'chips' }, ids.map((id) => chip(byId.get(id), id)));
  return el('section', { cls: 'col ' + cls }, [el('h3', { text: title }), ul]);
}

function renderTesting(view: ViewModel, actions: Actions, byId: Map<string, Item>): HTMLElement[] {
  const s = view.state;
  const used = new Set<string>([...s.exampleYes, ...s.exampleNo, ...s.tests.map((t) => t.itemId)]);

  const examples = el('div', { cls: 'cols' }, [
    column(TEXT.yes, 'yes', s.exampleYes, byId),
    column(TEXT.no, 'no', s.exampleNo, byId),
  ]);

  const counter = el('p', { cls: 'counter', text: TEXT.testsLeft(view.testsLeft, TEST_BUDGET) });

  const input = el('input', {
    attrs: {
      type: 'search',
      id: 'search',
      placeholder: TEXT.searchPlaceholder,
      'aria-label': TEXT.searchLabel,
      autocomplete: 'off',
    },
  });
  input.value = query;

  const list = el('div', { cls: 'items' });
  const fill = () => {
    const q = norm(query.trim());
    list.replaceChildren();
    const shown = view.items.filter((i) => !q || norm(i.name).includes(q));
    if (shown.length === 0) list.append(el('p', { cls: 'muted', text: TEXT.noResults }));
    for (const item of shown) {
      const b = el('button', {
        cls: 'item',
        text: itemLabel(item, item.id),
        attrs: { type: 'button' },
      });
      b.disabled = used.has(item.id) || view.testsLeft <= 0;
      b.addEventListener('click', () => actions.test(item.id));
      list.append(b);
    }
  };
  input.addEventListener('input', () => {
    query = input.value;
    fill();
  });
  fill();

  const mine = s.tests.length
    ? el('div', { cls: 'cols' }, [
        column(
          TEXT.yes,
          'yes',
          s.tests.filter((t) => t.result).map((t) => t.itemId),
          byId,
        ),
        column(
          TEXT.no,
          'no',
          s.tests.filter((t) => !t.result).map((t) => t.itemId),
          byId,
        ),
      ])
    : el('p', { cls: 'muted', text: TEXT.noTestsYet });

  const start = el('button', { cls: 'primary', text: TEXT.startExam, attrs: { type: 'button' } });
  start.addEventListener('click', () => actions.startExam());

  return [
    examples,
    counter,
    el('div', { cls: 'search' }, [input]),
    list,
    el('h2', { text: TEXT.myTests }),
    mine,
    start,
  ];
}

function renderExam(view: ViewModel, actions: Actions, byId: Map<string, Item>): HTMLElement[] {
  const s = view.state;
  const answered = s.examItemIds.filter((id) => typeof s.examAnswers[id] === 'boolean').length;
  const rows = s.examItemIds.map((id) => {
    const cur = s.examAnswers[id];
    const mk = (label: string, value: boolean) => {
      const b = el('button', {
        cls: 'choice' + (cur === value ? ' selected' : ''),
        text: label,
        attrs: { type: 'button', 'aria-pressed': String(cur === value) },
      });
      b.addEventListener('click', () => actions.answer(id, value));
      return b;
    };
    return el('li', { cls: 'exam-row' }, [
      el('span', { cls: 'exam-name', text: itemLabel(byId.get(id), id) }),
      el('span', { cls: 'choices' }, [mk(TEXT.fits, true), mk(TEXT.fitsNot, false)]),
    ]);
  });
  const submit = el('button', { cls: 'primary', text: TEXT.submit, attrs: { type: 'button' } });
  submit.disabled = answered < s.examItemIds.length || s.examItemIds.length === 0;
  submit.addEventListener('click', () => actions.submit());
  return [
    el('p', { cls: 'muted', text: TEXT.examIntro }),
    el('ul', { cls: 'exam' }, rows),
    el('p', { cls: 'counter', text: TEXT.answered(answered, s.examItemIds.length || EXAM_SIZE) }),
    submit,
  ];
}

function renderResult(view: ViewModel, actions: Actions): HTMLElement[] {
  const o = view.state.outcome;
  const feedback = el('p', { cls: 'copy-feedback', attrs: { role: 'status' } });
  const copyBtn = el('button', { cls: 'primary', text: TEXT.copy, attrs: { type: 'button' } });
  copyBtn.addEventListener('click', async () => {
    const ok = await actions.copy();
    feedback.replaceChildren();
    if (ok) {
      feedback.textContent = TEXT.copied;
    } else {
      feedback.append(
        el('span', { text: TEXT.copyFailed }),
        el('pre', { cls: 'share', text: view.shareText }),
      );
    }
  });
  return [
    el('p', { cls: 'rule-label', text: TEXT.ruleIs }),
    el('p', { cls: 'rule', text: view.ruleText }),
    el('p', { cls: 'big', text: o ? TEXT.correct(o.correct, o.total) : '' }),
    el('p', { text: o ? TEXT.score(o.score) : '' }),
    el('p', { text: TEXT.streak(view.streak) }),
    copyBtn,
    feedback,
    el('p', { cls: 'muted' }, [
      TEXT.nextPuzzle + ' ',
      el('strong', { text: view.countdown, attrs: { id: 'countdown' } }),
    ]),
  ];
}

export function render(root: HTMLElement, view: ViewModel, actions: Actions): void {
  const hadSearchFocus = document.activeElement?.id === 'search';
  const prevScroll = root.querySelector<HTMLElement>('.items')?.scrollTop ?? 0;
  const byId = new Map(view.items.map((i) => [i.id, i]));
  const phase = view.state.phase;

  let body: HTMLElement[];
  let heading: string;
  if (phase === 'testing') {
    heading = TEXT.title(view.puzzleNumber);
    body = renderTesting(view, actions, byId);
  } else if (phase === 'exam') {
    heading = TEXT.examTitle;
    body = renderExam(view, actions, byId);
  } else {
    heading = TEXT.resultTitle;
    body = renderResult(view, actions);
  }

  root.replaceChildren(
    el('main', { cls: 'wrap' }, [
      el('h1', { text: heading }),
      ...(phase === 'testing' ? [] : [el('p', { cls: 'muted', text: TEXT.title(view.puzzleNumber) })]),
      ...body,
    ]),
  );

  const items = root.querySelector<HTMLElement>('.items');
  if (items) items.scrollTop = prevScroll;
  if (hadSearchFocus) {
    const input = root.querySelector<HTMLInputElement>('#search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}
