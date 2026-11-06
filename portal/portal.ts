import { getPuzzle } from '../src/generator/generator';
import { validateRule } from '../src/generator/fairness';
import type { Ctx, Problem } from '../src/generator/fairness';
import { describe, difficultyOf, matchIds } from '../src/rules/rule';
import { newGame } from '../src/game/game';
import { toDateKey, normalizeDateKey } from '../src/lib/date';
import { items as itemsData, properties as propertiesData, overrides as overridesData } from '../src/data';
import type { Item, Property, Rule } from '../src/types';

const BANNER =
  'Wijzig je data nadat de site live is, dan verschuiven toekomstige (en mogelijk huidige) puzzels. Zet de dag van vandaag vast met een override.';

const PROBLEM_TEXT: Record<Problem, string> = {
  'unknown-property': 'De regel gebruikt een onbekende eigenschap.',
  'too-few-matching': 'Te weinig items voldoen aan de regel.',
  'too-few-non-matching': 'Te weinig items voldoen niet aan de regel.',
  ambiguous: 'De regel is dubbelzinnig: een andere (eenvoudigere) regel geeft dezelfde uitkomst.',
};

// --- state (ctx wordt nooit in-place aangepast: getPuzzle cachet per ctx-object) ---
let items: Item[] = structuredClone(itemsData);
let properties: Property[] = structuredClone(propertiesData);
let overrides: Record<string, Rule> = structuredClone(overridesData);
let ctx: Ctx = makeCtx();
let dateKey = normalizeDateKey(toDateKey(new Date()));
let builder = { p1: '', n1: false, p2: '', n2: false };
let builderDate = '';

function makeCtx(): Ctx {
  return { items: items.slice(), properties: properties.slice(), overrides: { ...overrides } };
}
function rebuildCtx(): void {
  ctx = makeCtx();
}

// --- DOM helpers ---
type Attrs = Record<string, unknown>;
function h(tag: string, attrs: Attrs = {}, ...kids: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}
function setStatus(msg: string, ok = true): void {
  const s = document.getElementById('status')!;
  s.textContent = msg;
  s.className = 'status ' + (ok ? 'ok' : 'err');
}

async function save(file: 'items' | 'properties' | 'overrides', data: unknown): Promise<boolean> {
  try {
    const res = await fetch('/__portal/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, data }),
    });
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return true;
  } catch (e) {
    setStatus(`Opslaan van ${file} mislukt: ${e instanceof Error ? e.message : String(e)}`, false);
    return false;
  }
}

// --- rule helpers ---
const lit = (id: string, neg: boolean): Rule => (neg ? { t: 'not', r: { t: 'prop', id } } : { t: 'prop', id });

function ruleFromBuilder(): Rule | null {
  if (!builder.p1) return null;
  const a = lit(builder.p1, builder.n1);
  return builder.p2 ? { t: 'and', a, b: lit(builder.p2, builder.n2) } : a;
}
function toLiteral(r: Rule): { id: string; neg: boolean } | null {
  if (r.t === 'prop') return { id: r.id, neg: false };
  if (r.t === 'not' && r.r.t === 'prop') return { id: r.r.id, neg: true };
  return null;
}
function loadBuilderFrom(rule: Rule): void {
  const single = toLiteral(rule);
  if (single) {
    builder = { p1: single.id, n1: single.neg, p2: '', n2: false };
  } else if (rule.t === 'and') {
    const a = toLiteral(rule.a);
    const b = toLiteral(rule.b);
    if (a && b) {
      builder = { p1: a.id, n1: a.neg, p2: b.id, n2: b.neg };
      return;
    }
    builder = { p1: '', n1: false, p2: '', n2: false };
  } else {
    builder = { p1: '', n1: false, p2: '', n2: false };
  }
}
function safeDescribe(rule: Rule): string {
  try {
    return describe(rule, properties);
  } catch (e) {
    return `(onbekend: ${e instanceof Error ? e.message : String(e)})`;
  }
}
function collectIds(r: Rule, out: Set<string>): Set<string> {
  if (r.t === 'prop') out.add(r.id);
  else if (r.t === 'not') collectIds(r.r, out);
  else {
    collectIds(r.a, out);
    collectIds(r.b, out);
  }
  return out;
}
function problemsOf(rule: Rule): string[] {
  const probs = validateRule(rule, { items, properties }).map((p) => PROBLEM_TEXT[p]);
  if (rule.t === 'and' && collectIds(rule, new Set()).size < 2) {
    probs.push('Kies twee verschillende eigenschappen.');
  }
  return probs;
}
function names(ids: string[]): HTMLElement {
  const byId = new Map(items.map((i) => [i.id, i]));
  return h('div', { class: 'chips' }, ...ids.map((id) => h('span', {}, `${byId.get(id)?.emoji ?? ''} ${byId.get(id)?.name ?? id}`)));
}
function problemList(probs: string[], cls = 'problems'): HTMLElement | null {
  return probs.length ? h('ul', { class: cls }, ...probs.map((p) => h('li', {}, p))) : null;
}

// --- sectie: dagpuzzel ---
function renderDay(): HTMLElement {
  const sec = h('section', {}, h('h2', {}, 'Dagpuzzel'));
  const input = h('input', { type: 'date', value: dateKey }) as HTMLInputElement;
  input.addEventListener('change', () => {
    if (!input.value) return;
    dateKey = normalizeDateKey(input.value);
    render();
  });
  sec.append(h('div', { class: 'row' }, h('label', {}, 'Datum: ', input)));

  const box = h('div', { class: 'box' });
  try {
    const puzzle = getPuzzle(dateKey, ctx);
    const matching = matchIds(puzzle.rule, items);
    const game = newGame(puzzle, items);
    const probs = problemsOf(puzzle.rule);
    box.append(
      h('div', {}, `Puzzel #${puzzle.number} (${puzzle.dateKey}) - `, puzzle.isOverride ? 'override' : 'gegenereerd'),
      h('div', {}, h('strong', {}, `Regel: ${safeDescribe(puzzle.rule)}`)),
      h('div', {}, `Moeilijkheid: ${difficultyOf(puzzle.rule)}`),
      h('div', {}, `Voldoen: ${matching.length} - voldoen niet: ${items.length - matching.length}`),
      h('div', {}, 'Voorbeelden die voldoen:'),
      names(game.exampleYes),
      h('div', {}, 'Voorbeelden die niet voldoen:'),
      names(game.exampleNo),
      probs.length ? h('div', {}, 'Problemen:') : h('div', { class: 'muted' }, 'Geen problemen.'),
    );
    const pl = problemList(probs);
    if (pl) box.append(pl);
    if (builderDate !== dateKey) {
      builderDate = dateKey;
      loadBuilderFrom(puzzle.rule);
    }
  } catch (e) {
    box.append(h('div', { class: 'problems' }, `Kon puzzel niet bepalen: ${e instanceof Error ? e.message : String(e)}`));
    if (builderDate !== dateKey) builderDate = dateKey;
  }
  sec.append(box);
  return sec;
}

// --- sectie: regelbouwer ---
function propSelect(value: string, optional: boolean, onChange: (v: string) => void): HTMLElement {
  const sel = h('select', {}) as HTMLSelectElement;
  sel.append(h('option', { value: '' }, optional ? '(geen)' : '(kies)'));
  for (const p of properties) sel.append(h('option', { value: p.id }, `${p.label} [${p.id}]`));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
function renderBuilder(): HTMLElement {
  const sec = h('section', {}, h('h2', {}, `Regelbouwer (override voor ${dateKey})`));
  const check = (checked: boolean, onChange: (v: boolean) => void) => {
    const c = h('input', { type: 'checkbox', checked }) as HTMLInputElement;
    c.addEventListener('change', () => onChange(c.checked));
    return h('label', {}, c, ' niet');
  };
  sec.append(
    h('div', { class: 'row' }, propSelect(builder.p1, false, (v) => ((builder.p1 = v), render())), check(builder.n1, (v) => ((builder.n1 = v), render()))),
    h('div', { class: 'row' }, 'en ', propSelect(builder.p2, true, (v) => ((builder.p2 = v), render())), check(builder.n2, (v) => ((builder.n2 = v), render()))),
  );
  const rule = ruleFromBuilder();
  const box = h('div', { class: 'box' });
  let probs: string[] = ['Kies een eerste eigenschap.'];
  if (rule) {
    probs = problemsOf(rule);
    const matching = matchIds(rule, items).length;
    box.append(
      h('div', {}, h('strong', {}, `Regel: ${safeDescribe(rule)}`)),
      h('div', {}, `Moeilijkheid: ${difficultyOf(rule)} - voldoen: ${matching}, voldoen niet: ${items.length - matching}`),
      probs.length ? h('div', {}, 'Problemen:') : h('div', { class: 'muted' }, 'Geen problemen.'),
    );
  } else {
    box.append(h('div', { class: 'muted' }, 'Nog geen regel.'));
  }
  const pl = problemList(probs);
  if (pl) box.append(pl);
  sec.append(box);

  const saveBtn = h('button', { disabled: !rule || probs.length > 0 }, 'Sla op als override voor deze datum');
  saveBtn.addEventListener('click', async () => {
    const r = ruleFromBuilder();
    if (!r || problemsOf(r).length > 0) return setStatus('Opslaan geblokkeerd: de regel heeft problemen.', false);
    const next = { ...overrides, [dateKey]: r };
    if (await save('overrides', next)) {
      overrides = next;
      rebuildCtx();
      setStatus(`Override voor ${dateKey} opgeslagen.`);
      render();
    }
  });
  const delBtn = h('button', { disabled: !(dateKey in overrides) }, 'Verwijder override');
  delBtn.addEventListener('click', async () => {
    if (!(dateKey in overrides)) return;
    const next = { ...overrides };
    delete next[dateKey];
    if (await save('overrides', next)) {
      overrides = next;
      rebuildCtx();
      builderDate = '';
      setStatus(`Override voor ${dateKey} verwijderd.`);
      render();
    }
  });
  sec.append(h('div', { class: 'row' }, saveBtn, delBtn));
  return sec;
}

// --- datavalidatie ---
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PROP_ID = /^[a-z0-9]+(_[a-z0-9]+)*$/;

/** Harde fouten: opslaan wordt geblokkeerd. */
function itemErrors(it: Item, all: Item[], props: Property[], isNew: boolean): string[] {
  const errs: string[] = [];
  if (!KEBAB.test(it.id)) errs.push('Id moet kebab-case zijn (kleine letters, cijfers, streepjes).');
  if (isNew && all.some((x) => x.id === it.id)) errs.push('Dit id bestaat al.');
  if (!it.name.trim()) errs.push('Naam is leeg.');
  if (!it.emoji.trim()) errs.push('Emoji is leeg.');
  const known = new Set(props.map((p) => p.id));
  for (const p of it.props) if (!known.has(p)) errs.push(`Onbekende eigenschap: ${p}`);
  return errs;
}
/** Zachte waarschuwingen: dezelfde invarianten als tests/data.test.ts. */
function itemWarnings(it: Item): string[] {
  const w: string[] = [];
  const has = (p: string) => it.props.includes(p);
  const cats = ['dier', 'plant', 'voorwerp', 'plaats'].filter(has);
  if (cats.length !== 1) w.push(`Een item hoort in precies een categorie (nu ${cats.length}).`);
  if ((has('dier') || has('plant')) !== has('levend')) w.push('"levend" moet kloppen met dier of plant.');
  if (has('zoogdier') && !has('dier')) w.push('Een zoogdier moet een dier zijn.');
  if (has('heeft_vier_poten') && (has('plant') || has('plaats'))) w.push('Vier poten kan niet bij een plant of plaats.');
  if (!has('in_huis') && !has('buiten')) w.push('Item moet in_huis of buiten hebben.');
  return w;
}
function globalWarnings(its: Item[], props: Property[]): string[] {
  const w: string[] = [];
  if (props.length !== 30) w.push(`tests/data.test.ts verwacht precies 30 eigenschappen (nu ${props.length}).`);
  if (its.length < 150) w.push(`tests/data.test.ts verwacht minstens 150 items (nu ${its.length}).`);
  return w;
}
function confirmWarnings(w: string[]): boolean {
  return w.length === 0 || confirm('Waarschuwing:\n- ' + w.join('\n- ') + '\n\nToch opslaan?');
}

async function commitItems(next: Item[], msg: string): Promise<void> {
  const warns = globalWarnings(next, properties);
  if (!confirmWarnings(warns)) return;
  if (await save('items', next)) {
    setStatus(msg + ' Pagina wordt herladen...');
    location.reload();
  }
}

// --- sectie: data ---
function renderItems(): HTMLElement {
  const sec = h('section', {}, h('h2', {}, `Items (${items.length})`));
  for (const warn of globalWarnings(items, properties)) sec.append(h('div', { class: 'warn' }, warn));

  // toevoegen
  const nameIn = h('input', { type: 'text', placeholder: 'naam' }) as HTMLInputElement;
  const emojiIn = h('input', { type: 'text', placeholder: 'emoji', size: 4 }) as HTMLInputElement;
  const idIn = h('input', { type: 'text', placeholder: 'id (kebab-case)' }) as HTMLInputElement;
  nameIn.addEventListener('input', () => {
    idIn.value = nameIn.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  });
  const addBtn = h('button', {}, 'Item toevoegen');
  addBtn.addEventListener('click', async () => {
    const it: Item = { id: idIn.value.trim(), name: nameIn.value.trim(), emoji: emojiIn.value.trim(), props: [] };
    const errs = itemErrors(it, items, properties, true);
    if (errs.length) return setStatus(errs.join(' '), false);
    await commitItems([...items, it], `Item ${it.id} toegevoegd (vink eigenschappen aan en sla op).`);
  });
  sec.append(h('div', { class: 'box row' }, nameIn, emojiIn, idIn, addBtn));

  for (const item of items) sec.append(renderItem(item));
  return sec;
}
function renderItem(item: Item): HTMLElement {
  const d = h('details', {}, h('summary', {}, `${item.emoji} ${item.name} `, h('span', { class: 'muted' }, `[${item.id}]`)));
  const nameIn = h('input', { type: 'text', value: item.name }) as HTMLInputElement;
  const emojiIn = h('input', { type: 'text', value: item.emoji, size: 4 }) as HTMLInputElement;
  const boxes = new Map<string, HTMLInputElement>();
  const grid = h('div', { class: 'grid' });
  for (const p of properties) {
    const c = h('input', { type: 'checkbox', checked: item.props.includes(p.id) }) as HTMLInputElement;
    boxes.set(p.id, c);
    grid.append(h('label', {}, c, ` ${p.id}`));
  }
  const saveBtn = h('button', {}, 'Opslaan');
  saveBtn.addEventListener('click', async () => {
    const updated: Item = {
      id: item.id,
      name: nameIn.value.trim(),
      emoji: emojiIn.value.trim(),
      props: properties.filter((p) => boxes.get(p.id)!.checked).map((p) => p.id),
    };
    const errs = itemErrors(updated, items, properties, false);
    if (errs.length) return setStatus(errs.join(' '), false);
    if (!confirmWarnings(itemWarnings(updated))) return;
    await commitItems(items.map((i) => (i.id === item.id ? updated : i)), `Item ${item.id} opgeslagen.`);
  });
  const delBtn = h('button', {}, 'Verwijder item');
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Item ${item.id} verwijderen?`)) return;
    await commitItems(items.filter((i) => i.id !== item.id), `Item ${item.id} verwijderd.`);
  });
  d.append(h('div', { class: 'row' }, nameIn, emojiIn), grid, h('div', { class: 'row' }, saveBtn, delBtn));
  const w = itemWarnings(item);
  const wl = problemList(w, 'warn');
  if (wl) d.append(wl);
  return d;
}

function overrideUsers(propId: string): string[] {
  return Object.entries(overrides)
    .filter(([, r]) => collectIds(r, new Set()).has(propId))
    .map(([k]) => k);
}

function renderProperties(): HTMLElement {
  const sec = h('section', {}, h('h2', {}, `Eigenschappen (${properties.length})`));

  const idIn = h('input', { type: 'text', placeholder: 'id (snake_case)' }) as HTMLInputElement;
  const labelIn = h('input', { type: 'text', placeholder: 'label, bijv. "is rond"' }) as HTMLInputElement;
  const negIn = h('input', { type: 'text', placeholder: 'negLabel, bijv. "is niet rond"' }) as HTMLInputElement;
  const addBtn = h('button', {}, 'Eigenschap toevoegen');
  addBtn.addEventListener('click', async () => {
    const p: Property = { id: idIn.value.trim(), label: labelIn.value.trim(), negLabel: negIn.value.trim() };
    if (!PROP_ID.test(p.id)) return setStatus('Id moet snake_case zijn (kleine letters, cijfers, underscores).', false);
    if (properties.some((x) => x.id === p.id)) return setStatus('Dit id bestaat al.', false);
    if (!p.label || !p.negLabel) return setStatus('Label en negLabel zijn verplicht.', false);
    const next = [...properties, p];
    if (!confirmWarnings(globalWarnings(items, next))) return;
    if (await save('properties', next)) {
      setStatus('Eigenschap toegevoegd. Pagina wordt herladen...');
      location.reload();
    }
  });
  sec.append(h('div', { class: 'box row' }, idIn, labelIn, negIn, addBtn));

  for (const p of properties) {
    const lIn = h('input', { type: 'text', value: p.label, size: 28 }) as HTMLInputElement;
    const nIn = h('input', { type: 'text', value: p.negLabel, size: 28 }) as HTMLInputElement;
    const sBtn = h('button', {}, 'Opslaan');
    sBtn.addEventListener('click', async () => {
      if (!lIn.value.trim() || !nIn.value.trim()) return setStatus('Label en negLabel zijn verplicht.', false);
      const next = properties.map((x) => (x.id === p.id ? { id: p.id, label: lIn.value.trim(), negLabel: nIn.value.trim() } : x));
      if (await save('properties', next)) {
        setStatus('Eigenschap opgeslagen. Pagina wordt herladen...');
        location.reload();
      }
    });
    const dBtn = h('button', {}, 'Verwijder');
    dBtn.addEventListener('click', async () => {
      const used = overrideUsers(p.id);
      if (used.length) {
        return setStatus(`Kan ${p.id} niet verwijderen: gebruikt door override(s) op ${used.join(', ')}. Verwijder die eerst.`, false);
      }
      const nextProps = properties.filter((x) => x.id !== p.id);
      const nextItems = items.map((i) => ({ ...i, props: i.props.filter((x) => x !== p.id) }));
      const holders = items.filter((i) => i.props.includes(p.id)).length;
      const warns = [`${p.id} wordt ook verwijderd uit ${holders} item(s).`, ...globalWarnings(nextItems, nextProps)];
      if (!confirm('Eigenschap verwijderen?\n- ' + warns.join('\n- '))) return;
      // eerst items (verwijst niet meer naar de eigenschap), dan properties
      if (!(await save('items', nextItems))) return;
      if (await save('properties', nextProps)) {
        setStatus(`Eigenschap ${p.id} verwijderd. Pagina wordt herladen...`);
        location.reload();
      }
    });
    sec.append(h('div', { class: 'row' }, h('code', {}, p.id), lIn, nIn, sBtn, dBtn));
  }
  return sec;
}

function render(): void {
  const app = document.getElementById('app')!;
  const open = new Set<string>();
  app.querySelectorAll('details[open] summary').forEach((s) => open.add(s.textContent ?? ''));
  app.replaceChildren(
    renderDay(),
    renderBuilder(),
    h('h2', {}, 'Data'),
    renderItems(),
    renderProperties(),
  );
  app.querySelectorAll('details').forEach((d) => {
    if (open.has(d.querySelector('summary')?.textContent ?? '\u0000')) d.setAttribute('open', '');
  });
}

document.getElementById('banner')!.textContent = BANNER;
render();
