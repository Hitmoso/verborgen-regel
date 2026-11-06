# Verborgen Regel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een dagelijkse Nederlandstalige puzzel waarin je een geheime regel afleidt door items te testen, met een eindtoets, plus een lokaal developerportaal om regels en data aan te passen.

**Architecture:** Statische Vite + TypeScript site zonder framework en zonder server. Pure logicamodules (regels, generator, spel, score, opslag) staan los van het scherm. De dagelijkse regel volgt deterministisch uit de datum. Het gokken zit achter een `GuessMethod`-interface zodat het later vervangbaar is. Het portaal draait alleen onder `vite dev` en zit niet in de build.

**Tech Stack:** Vite, TypeScript (strict), Vitest, gewone DOM-API. Geen UI-framework.

**Spec:** `docs/superpowers/specs/2026-11-06-verborgen-regel-design.md` (lees die eerst). Projectmap = `C:\Users\mjvvu\Desktop\Claude` (geen git-repo; Task 1 doet `git init`). Shell is PowerShell: gebruik `;` in plaats van `&&`.

## Global Constraints

- UI en alle spelteksten zijn Nederlands; teksten staan in databestanden of op één plek, niet verspreid door de logica.
- Geen server, geen accounts, geen `Math.random` in generator of spel: dezelfde datum geeft voor iedereen dezelfde puzzel (seeded met `hashString` + `mulberry32`).
- Constanten staan in `src/config.ts`: `TEST_BUDGET = 10`, `EXAMPLES_PER_SIDE = 3`, `EXAM_SIZE = 8` (4 voldoen + 4 niet), `MIN_SIDE = 17`, `RECENT_DAYS = 14`, `TIMEZONE = 'Europe/Amsterdam'`, `EPOCH = '2026-11-07'` (eerste puzzel; eigenaar zet dit bij publicatie), `STORAGE_KEY = 'verborgen-regel:v1'`.
- Score-waarden staan alleen in `src/game/score.ts`.
- Het portaal is alleen lokaal (`apply: 'serve'`), mag niet in `dist/` terechtkomen.
- Regels zijn `prop`, `not` of `and`; de generator maakt alleen: één eigenschap, `not(prop)`, of `and` van twee literals (prop of not(prop)) met verschillende eigenschappen.

## Review Focus

- Dubbel tikken op een item, of tikken op een voorbeelditem: kost geen test en verandert niets (Task 6).
- Tests op zijn: verdere tests worden genegeerd en de eindtoets blijft mogelijk (Task 6).
- Pagina sluiten of herladen midden in de eindtoets: dezelfde 8 items komen terug, al ingevulde antwoorden blijven staan (Task 7).
- Apparaatdatum vóór `EPOCH` of een opgeslagen spel van een andere dag: vroege datum geeft puzzel #1, oud spel wordt genegeerd (Task 1 en 7).
- Kapotte of ontbrekende localStorage (privémodus, verkeerde vorm): spel start gewoon opnieuw, geen crash (Task 7).

---

### Task 1: Scaffold, config en hulpfuncties

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` (leeg skelet met `<div id="app">`), `.gitignore` (`node_modules`, `dist`)
- Create: `src/config.ts`, `src/types.ts`, `src/lib/rng.ts`, `src/lib/date.ts`
- Test: `tests/rng.test.ts`, `tests/date.test.ts`

**Interfaces:**
- Produces (`src/types.ts`):
  ```ts
  export type Property = { id: string; label: string; negLabel: string };
  export type Item = { id: string; name: string; emoji: string; props: string[] }; // props = ids die waar zijn
  export type Rule = { t: 'prop'; id: string } | { t: 'not'; r: Rule } | { t: 'and'; a: Rule; b: Rule };
  export type Puzzle = { number: number; dateKey: string; rule: Rule; isOverride: boolean };
  ```
- Produces (`src/lib/rng.ts`): `hashString(s: string): number` (FNV-1a 32-bit), `mulberry32(seed: number): () => number`, `shuffle<T>(arr: readonly T[], rng: () => number): T[]` (Fisher-Yates op een kopie).
- Produces (`src/lib/date.ts`): `toDateKey(d: Date): string` (YYYY-MM-DD in Europe/Amsterdam, via `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' })`), `dayIndex(dateKey: string, epoch?: string): number` (kan negatief zijn), `normalizeDateKey(dateKey: string): string` (alles vóór `EPOCH` wordt `EPOCH`), `puzzleNumber(dateKey: string): number` (`max(0, dayIndex) + 1`), `msUntilNextPuzzle(now: Date): number` (uit Amsterdamse u/m/s: `((24-h)*3600 - m*60 - s)*1000`; DST-overgangsdagen mogen één uur afwijken), `addDays(dateKey: string, n: number): string`.

- [ ] **Step 1: Write the failing tests**
  - `rng.test.ts`: `hashString('a') === hashString('a')`, `!== hashString('b')`; twee `mulberry32(1)` geven dezelfde eerste 5 waarden, allemaal in `[0,1)`; `shuffle` bewaart de elementen (gesorteerd gelijk), muteert het origineel niet, en geeft met dezelfde seed dezelfde volgorde.
  - `date.test.ts`: `toDateKey(new Date(Date.UTC(2026,6,1,22,30))) === '2026-07-02'` (zomertijd); `toDateKey(new Date(Date.UTC(2026,0,1,22,30))) === '2026-01-01'` (wintertijd); `dayIndex('2026-11-10','2026-11-07') === 3`; `dayIndex('2026-11-01','2026-11-07') === -6`; `puzzleNumber(EPOCH) === 1`; `puzzleNumber('2020-01-01') === 1`; `normalizeDateKey('2020-01-01') === EPOCH`; `msUntilNextPuzzle(new Date(Date.UTC(2026,0,1,22,30))) === 30*60*1000`; `addDays('2026-11-30', 1) === '2026-12-01'`.
- [ ] **Step 2: Run to verify fail**: `git init; npm install; npx vitest run` → FAIL (modules ontbreken). Zet eerst `package.json` neer: scripts `dev`=`vite`, `build`=`tsc --noEmit && vite build`, `test`=`vitest run`; devDependencies `vite`, `typescript`, `vitest`, `@types/node` (huidige stabiele versies via `npm i -D`). `tsconfig`: strict, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `resolveJsonModule`, `lib ["ES2022","DOM"]`, `include ["src","tests","tools","portal"]`.
- [ ] **Step 3: Implement** `config.ts`, `types.ts`, `rng.ts`, `date.ts` volgens de signatures. `dayIndex` rekent met `Date.UTC` op de drie delen van de key.
- [ ] **Step 4: Run**: `npx vitest run` → PASS; `npx tsc --noEmit` → geen fouten.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "chore: scaffold, config, rng and date helpers"`

---

### Task 2: Regels (evaluate, describe, key, moeilijkheid)

**Files:**
- Create: `src/rules/rule.ts`
- Test: `tests/rule.test.ts`

**Interfaces:**
- Consumes: `Rule`, `Item`, `Property` uit `src/types.ts`.
- Produces (`src/rules/rule.ts`):
  - `evaluate(rule: Rule, item: Item): boolean`
  - `describe(rule: Rule, properties: Property[]): string` — `prop` → `label`; `not(prop)` → `negLabel`; `and` → `` `${a} en ${b}` ``; `not` van iets anders → `` `niet (${...})` ``; onbekende id → gooit `Error`.
  - `ruleKey(rule: Rule): string` — `prop` → `id`; `not` → `` `!${key}` ``; `and` → `` `(${[ka, kb].sort().join('&')})` `` (volgorde-onafhankelijk).
  - `matchIds(rule: Rule, items: Item[]): string[]` (ids in itemvolgorde)
  - `literalCount(rule: Rule): number` (aantal `prop`-bladeren)
  - `difficultyOf(rule: Rule): 'makkelijk' | 'gemiddeld' | 'moeilijk'` — 1 literal zonder `not` = makkelijk; 1 literal met `not`, of 2 literals zonder `not` = gemiddeld; 2 literals met minstens één `not` = moeilijk.

- [ ] **Step 1: Write the failing tests** met een kleine fixture (2 properties, 3 items): `evaluate` voor prop/not/and (inclusief `and(a, not(b))`); `describe` geeft `'kan zwemmen'`, `'kan niet zwemmen'`, `'kan zwemmen en kan niet vliegen'`, en gooit bij onbekende id; `ruleKey(and(a,b)) === ruleKey(and(b,a))` en `ruleKey(not(a)) !== ruleKey(a)`; `matchIds` geeft de juiste ids; `difficultyOf` voor alle vier de gevallen.
- [ ] **Step 2: Run** `npx vitest run tests/rule.test.ts` → FAIL.
- [ ] **Step 3: Implement** de functies; één recursieve `evaluate` is de enige plek met regel-semantiek.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: rule evaluation, description and difficulty"`

---

### Task 3: Data (eigenschappen en items)

**Files:**
- Create: `src/data/properties.json`, `src/data/items.json`, `src/data/overrides.json` (`{}`), `src/data/index.ts`
- Test: `tests/data.test.ts`

**Interfaces:**
- Produces (`src/data/index.ts`): `export const properties: Property[]`, `export const items: Item[]`, `export const overrides: Record<string, Rule>` (typed casts van de JSON-imports).

**De 30 eigenschappen** (id | label | negLabel), exact zo in `properties.json`:

| id | label | negLabel |
|---|---|---|
| levend | is levend | is niet levend |
| dier | is een dier | is geen dier |
| plant | is een plant | is geen plant |
| zoogdier | is een zoogdier | is geen zoogdier |
| voorwerp | is een voorwerp | is geen voorwerp |
| plaats | is een plaats | is geen plaats |
| kan_zwemmen | kan zwemmen | kan niet zwemmen |
| kan_vliegen | kan vliegen | kan niet vliegen |
| heeft_wielen | heeft wielen | heeft geen wielen |
| heeft_vier_poten | heeft vier poten | heeft geen vier poten |
| groter_dan_koelkast | is groter dan een koelkast | is niet groter dan een koelkast |
| zwaarder_dan_mens | is zwaarder dan een mens | is niet zwaarder dan een mens |
| past_in_broekzak | past in een broekzak | past niet in een broekzak |
| eetbaar | is eetbaar | is niet eetbaar |
| bevat_metaal | bevat metaal | bevat geen metaal |
| bevat_hout | bevat hout | bevat geen hout |
| bevat_glas | bevat glas | bevat geen glas |
| bevat_plastic | bevat plastic | bevat geen plastic |
| werkt_op_stroom | werkt op stroom | werkt niet op stroom |
| heeft_motor | heeft een motor | heeft geen motor |
| heeft_scherpe_rand | heeft een scherpe punt of rand | heeft geen scherpe punt of rand |
| in_huis | vind je meestal in een huis | vind je meestal niet in een huis |
| buiten | vind je meestal buiten | vind je meestal niet buiten |
| rond | is voornamelijk rond van vorm | is niet voornamelijk rond van vorm |
| zacht | voelt zacht aan | voelt niet zacht aan |
| met_water | heeft met water te maken | heeft niet met water te maken |
| in_nederland | kom je in Nederland tegen | kom je niet in Nederland tegen |
| maakt_geluid | kan geluid maken | kan geen geluid maken |
| kan_heet_worden | kan heet worden | kan niet heet worden |
| knoppen_of_scherm | heeft knoppen of een scherm | heeft geen knoppen of scherm |

**Items** (`items.json`, minimaal 150): per item `id` (kebab-case, uniek), `name` (Nederlands, enkelvoud, bijv. "Pinguïn"), `emoji` (één passende emoji), `props` (alle waar-ids). Verdeling: minstens 40 dieren, 10 planten/bomen, 60 voorwerpen, 15 plaatsen, de rest vrij. Label alleen `true` als het voor het *typische* voorbeeld klopt; laat items weg waarvan eigenschappen echt betwistbaar zijn. Elk item heeft precies één van `dier`/`plant`/`voorwerp`/`plaats`.

- [ ] **Step 1: Write the failing tests** (`data.test.ts`): ids uniek (items en properties); elke `props`-id bestaat; `items.length >= 150`; per item precies één van dier/plant/voorwerp/plaats; `dier` of `plant` ⇔ `levend`; `zoogdier` ⇒ `dier`; `heeft_vier_poten` ⇒ niet `plant`, niet `plaats`; per categorie minimaal 40/10/60/15; `properties.length === 30`.
- [ ] **Step 2: Run** `npx vitest run tests/data.test.ts` → FAIL.
- [ ] **Step 3: Write the data** en `index.ts`.
- [ ] **Step 4: Run** → PASS; los eventuele inconsistenties in de labels op, niet in de test.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: initial properties and item library"`

---

### Task 4: Generator en eerlijkheidscontrole

**Files:**
- Create: `src/generator/fairness.ts`, `src/generator/generator.ts`
- Test: `tests/fairness.test.ts`, `tests/generator.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `ruleKey`, `matchIds`, `literalCount` (Task 2); `hashString`, `mulberry32` (Task 1); `normalizeDateKey`, `dayIndex`, `puzzleNumber`, `addDays` (Task 1); `properties`, `items`, `overrides` (Task 3).
- Produces (`fairness.ts`):
  ```ts
  export type Ctx = { items: Item[]; properties: Property[]; overrides: Record<string, Rule> };
  export type Problem = 'unknown-property' | 'too-few-matching' | 'too-few-non-matching' | 'ambiguous';
  export function enumerateCandidates(properties: Property[]): Rule[]; // prop, not(prop), and(literal, literal) met verschillende eigenschappen, geen spiegelduplicaten, gesorteerd op ruleKey
  export function validateRule(rule: Rule, ctx: Pick<Ctx,'items'|'properties'>): Problem[];
  export function fairCandidates(ctx: Pick<Ctx,'items'|'properties'>): Rule[];
  ```
  `ambiguous` = er bestaat een kandidaat met andere `ruleKey`, dezelfde `matchIds` en `literalCount <= literalCount(rule)`. `too-few-*` gebruikt `MIN_SIDE`.
- Produces (`generator.ts`): `getPuzzle(dateKey: string, ctx?: Ctx): Puzzle` (default `ctx` = de echte data). `dateKey` wordt eerst genormaliseerd. Per dag: een geldige override (valideert zonder problemen, anders `console.warn` en terugvallen op genereren) of een seeded keuze uit `fairCandidates` minus de `ruleKey`s van de vorige `RECENT_DAYS` dagen (leeg → recency negeren). Seed = `hashString(dateKey)`, index = `Math.floor(rng() * pool.length)`. De reeks wordt vanaf `EPOCH` incrementeel berekend en per `ctx`-object gecachet (`WeakMap`), zodat 1000 dagen snel blijft.

- [ ] **Step 1: Write the failing tests**
  - `fairness.test.ts` met synthetische fixture: 60 items `i0..i59`; eigenschap `a` = i0–i29, `b` = i10–i44, `c` = i0–i4, `e` = i0–i39. Verwacht: `validateRule(prop b)` → `[]`; `not(b)` → `[]`; `and(a,b)` → `[]`; `prop c` → bevat `too-few-matching`; `not(c)` → bevat `too-few-non-matching`; onbekende id → bevat `unknown-property`; `and(a,e)` → bevat `ambiguous` (zelfde set als `a`, meer literals); `prop a` → `[]`. Tweede fixture met `d` identiek aan `a`: `prop a` en `prop d` allebei `ambiguous`. `enumerateCandidates` van 3 properties telt `3 + 3 + 3*4 = 18` regels en bevat geen `and(x,x)`.
  - `generator.test.ts` met echte data: `fairCandidates(echte data).length >= 100`; `getPuzzle(EPOCH)` twee keer gelijk; `getPuzzle(EPOCH).number === 1`, `getPuzzle(addDays(EPOCH,4)).number === 5`; voor 1000 dagen vanaf `EPOCH` geldt `validateRule(...) = []` en geen `ruleKey` komt voor binnen een venster van 14 opeenvolgende dagen; override geldig → `isOverride: true` en die regel; override met onbekende eigenschap → `isOverride: false` en `console.warn` aangeroepen; `getPuzzle('2020-01-01')` deep-equals `getPuzzle(EPOCH)`.
- [ ] **Step 2: Run** `npx vitest run tests/fairness.test.ts tests/generator.test.ts` → FAIL.
- [ ] **Step 3: Implement** beide modules volgens de signatures.
- [ ] **Step 4: Run** → PASS (als `fairCandidates < 100` of de 1000-dagentest faalt: breid de itemdata uit in Task 3, verlaag `MIN_SIDE` niet).
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: fairness validation and seeded daily generator"`

---

### Task 5: Score en deeltekst

**Files:**
- Create: `src/game/score.ts`, `src/game/share.ts`
- Test: `tests/score.test.ts`

**Interfaces:**
- Consumes: `TEST_BUDGET` (config).
- Produces: `computeScore(a: { correct: number; total: number; testsLeft: number }): number` = `Math.max(0, 10*correct - 10*(total - correct) + 2*testsLeft)`; de drie getallen staan als benoemde constanten bovenin `score.ts`. `buildShareText(a: { puzzleNumber: number; testsUsed: number; correct: number; total: number }): string` → `` `Regel #${n} ` `` + `'🔍'.repeat(used)` + `'⬜'.repeat(TEST_BUDGET - used)` + `` ` ${correct}/${total} ` `` + (`correct === total` ? `'✅'` : `'❌'`).

- [ ] **Step 1: Write the failing tests**: `computeScore({correct:8,total:8,testsLeft:10}) === 100`; `({8,8,0}) === 80`; `({4,8,5}) === 10`; `({0,8,0}) === 0`; `buildShareText({puzzleNumber:42,testsUsed:3,correct:8,total:8}) === 'Regel #42 🔍🔍🔍⬜⬜⬜⬜⬜⬜⬜ 8/8 ✅'`; met `correct:6` eindigt de tekst op ` 6/8 ❌`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: scoring and share text"`

---

### Task 6: Spelstatus en GuessMethod

**Files:**
- Create: `src/game/guess.ts`, `src/game/game.ts`
- Test: `tests/game.test.ts`

**Interfaces:**
- Consumes: `evaluate` (Task 2); `hashString`, `mulberry32`, `shuffle` (Task 1); `Puzzle`, `Item`; `TEST_BUDGET`, `EXAMPLES_PER_SIDE`, `EXAM_SIZE` (config); `computeScore` (Task 5, `src/game/score.ts`).
- Produces (`guess.ts`):
  ```ts
  export type GuessPrompt = { itemIds: string[] };
  export type GuessOutcome = { correct: number; total: number; perfect: boolean };
  export interface GuessMethod {
    id: string;
    prepare(ctx: { puzzle: Puzzle; seenItemIds: string[]; items: Item[] }): GuessPrompt;
    judge(ctx: { puzzle: Puzzle; prompt: GuessPrompt; answers: Record<string, boolean>; items: Item[] }): GuessOutcome;
  }
  export const examGuess: GuessMethod; // id 'exam'
  ```
  `examGuess.prepare` kiest deterministisch (seed `hashString(puzzle.dateKey + ':exam')`) uit de nog niet geziene items `EXAM_SIZE/2` die voldoen en `EXAM_SIZE/2` die niet voldoen (eerst sorteren op id, dan shufflen), schudt het geheel en geeft de ids. `judge` telt hoeveel antwoorden gelijk zijn aan `evaluate(puzzle.rule, item)`.
- Produces (`game.ts`):
  ```ts
  export type GameState = {
    dateKey: string; phase: 'testing' | 'exam' | 'done';
    exampleYes: string[]; exampleNo: string[];
    tests: { itemId: string; result: boolean }[];
    examItemIds: string[]; examAnswers: Record<string, boolean>;
    outcome?: { correct: number; total: number; perfect: boolean; testsLeft: number; score: number };
  };
  export function newGame(puzzle: Puzzle, items: Item[]): GameState;
  export function testsLeft(state: GameState): number;
  export function runTest(state: GameState, puzzle: Puzzle, items: Item[], itemId: string): GameState;
  export function startExam(state: GameState, puzzle: Puzzle, items: Item[], guess?: GuessMethod): GameState;
  export function setExamAnswer(state: GameState, itemId: string, value: boolean): GameState;
  export function submitExam(state: GameState, puzzle: Puzzle, items: Item[], guess?: GuessMethod): GameState;
  ```
  Alle functies geven een nieuw object terug, behalve bij een genegeerde actie: dan exact dezelfde referentie. Voorbeelden: `newGame` kiest seeded (`hashString(dateKey + ':examples')`, na sorteren op id) `EXAMPLES_PER_SIDE` items die voldoen en evenveel die niet voldoen. `runTest` negeert: fase ≠ `testing`, budget op, item al getest, item is een voorbeeld, onbekend id. `startExam` werkt alleen vanuit `testing`, zet `examItemIds` via `guess.prepare` (`seenItemIds` = voorbeelden + tests). `setExamAnswer` werkt alleen in fase `exam` voor een id in `examItemIds`. `submitExam` negeert als niet alle `examItemIds` een antwoord hebben; anders fase `done` en `outcome` uit `guess.judge` + `testsLeft` + `computeScore`.


- [ ] **Step 1: Write the failing tests** (echte data, puzzel van `EPOCH`): `newGame` heeft 3 voorbeelden per kant, alle `exampleYes` voldoen en alle `exampleNo` niet, is deterministisch, fase `testing`; `runTest` voegt een test toe met het juiste resultaat; **dubbel tikken en voorbeeld tikken geven dezelfde referentie terug**; **na 10 tests geeft de 11e dezelfde referentie**; `startExam` geeft 8 ids, 4 voldoen/4 niet, geen overlap met voorbeelden of tests, deterministisch; **worst case**: besteed 10 tests aan items die voldoen (en daarna een tweede game met 10 tests aan items die niet voldoen) en `startExam` geeft nog steeds 4/4; `startExam` buiten fase `testing` → zelfde referentie; `setExamAnswer` + `submitExam` met alle goede antwoorden → fase `done`, `outcome.perfect === true`; ontbrekende antwoorden → zelfde referentie; een stub-`GuessMethod` meegegeven aan `startExam` wordt gebruikt (swappability).
- [ ] **Step 2: Run** `npx vitest run tests/game.test.ts` → FAIL.
- [ ] **Step 3: Implement** volgens de signatures.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: game state machine and exam guess method"`

---

### Task 7: Opslag en streak

**Files:**
- Create: `src/storage/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `GameState` (Task 6), `STORAGE_KEY`, `addDays` (Task 1).
- Produces:
  ```ts
  type Store = Pick<Storage, 'getItem' | 'setItem'>;
  export function isValidGameState(x: unknown): x is GameState;
  export function saveGame(state: GameState, store?: Store): void;      // vangt fouten af
  export function loadGame(dateKey: string, store?: Store): GameState | null; // null bij ontbreken, andere dag, ongeldige vorm, kapotte JSON of storage-fout
  export type StreakInfo = { lastCompleted: string | null; streak: number };
  export function loadStreak(store?: Store): StreakInfo;
  export function recordCompletion(dateKey: string, store?: Store): StreakInfo; // gisteren voltooid → streak+1, zelfde dag → ongewijzigd, anders 1
  export function currentStreak(info: StreakInfo, todayKey: string): number; // 0 als lastCompleted niet vandaag of gisteren is
  ```
  `store` default is `localStorage`; de spelstatus en streak gebruiken `STORAGE_KEY + ':game'` en `STORAGE_KEY + ':streak'`.

- [ ] **Step 1: Write the failing tests** met een in-memory nepstore: opslaan en laden geeft deep-equal; **midden in de eindtoets** opgeslagen status (fase `exam`, `examItemIds` en deels `examAnswers`) komt identiek terug; status van een andere `dateKey` → `null`; kapotte JSON, `{}`, status met onbekende fase of `tests` geen array → `null`; een store die bij `getItem`/`setItem` gooit crasht niet (`null` resp. no-op); streak: eerste voltooiing → 1, volgende dag → 2, zelfde dag twee keer → 2, dag overgeslagen → 1; `currentStreak` geeft 0 als `lastCompleted` twee dagen geleden was.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: persistence and streak"`

---

### Task 8: Spelscherm

**Files:**
- Create: `src/main.ts`, `src/ui/render.ts`, `src/styles.css`
- Modify: `index.html` (laad `/src/main.ts`, titel "Verborgen Regel", viewport-meta)

**Interfaces:**
- Consumes: `getPuzzle`, `items`, `properties`, `newGame`/`runTest`/`startExam`/`setExamAnswer`/`submitExam`/`testsLeft`, `describe`, `buildShareText`, `puzzleNumber`, `toDateKey`, `msUntilNextPuzzle`, `loadGame`/`saveGame`/`recordCompletion`/`loadStreak`/`currentStreak`.
- Produces: `render(root: HTMLElement, view: ViewModel, actions: Actions): void` in `src/ui/render.ts` (zelf typen), en `main.ts` die bij laden: `dateKey = toDateKey(new Date())`, puzzel ophalen, `loadGame(puzzle.dateKey) ?? newGame(...)`, renderen, en na elke actie opslaan en opnieuw renderen.

**Schermen (alle teksten Nederlands, mobiel eerst):**
1. *Testen*: kop "Puzzel #N", twee kolommen met de voorbeelden (✅ voldoet / ❌ voldoet niet), teller "Tests over: n/10", zoekveld, lijst met alle items als knoppen (uitgeschakeld als al getest/voorbeeld of budget op), de eigen tests in twee kolommen, knop "Start eindtoets".
2. *Eindtoets*: 8 items, per item twee knoppen "Past" / "Past niet", knop "Lever in" uitgeschakeld tot alles beantwoord is.
3. *Resultaat*: de regel via `describe`, "n/8 goed", score, streak, knop "Kopieer resultaat" (`navigator.clipboard.writeText(buildShareText(...))`, met korte bevestiging), aftelling naar volgende puzzel die elke seconde ververst; bij `recordCompletion` aanroepen precies één keer bij overgang naar `done`.
Bij herladen midden in de eindtoets komt dezelfde toets terug met al ingevulde antwoorden (volgt uit opgeslagen status).

- [ ] **Step 1: Implement** de schermen en de koppeling; geen automatische test voor DOM (logica is gedekt in Task 5–7).
- [ ] **Step 2: Verify build**: `npm run build` → slaagt zonder TypeScript-fouten.
- [ ] **Step 3: Verify in de browser** (`npm run dev`, open de getoonde URL, gebruik de ingebouwde browser): speel een volledige puzzel; controleer: dubbel tikken kost geen test; na 10 tests zijn alle itemknoppen uitgeschakeld; herladen midden in de eindtoets behoudt de toets; na afronden herladen toont het resultaat; mobiele breedte 375px zonder horizontaal scrollen; geen console-errors.
- [ ] **Step 4: Commit**: `git add -A; git commit -m "feat: playable game UI"`

---

### Task 9: Developerportaal (alleen lokaal)

**Files:**
- Create: `tools/portalPlugin.ts`, `portal/index.html`, `portal/portal.ts`
- Modify: `vite.config.ts` (voeg `portalPlugin()` toe)
- Test: `tests/portalSave.test.ts`

**Interfaces:**
- Consumes: `getPuzzle`, `validateRule`, `difficultyOf`, `describe`, `matchIds`, `newGame`, de databestanden en `src/types.ts`.
- Produces (`tools/portalPlugin.ts`):
  ```ts
  export function applySave(rootDir: string, file: string, data: unknown): void;
  // file ∈ 'items' | 'properties' | 'overrides'; anders gooit het. Controleert de vorm
  // (items/properties: array van objecten; overrides: object) en schrijft
  // JSON.stringify(data, null, 2) naar <rootDir>/src/data/<file>.json.
  export function portalPlugin(): import('vite').Plugin; // apply: 'serve'; POST /__portal/save met body { file, data } → 200 {ok:true} of 400 {error}
  ```
- Het portaal draait op `/portal/index.html` onder `vite dev` en bevat:
  - **Dagpuzzel**: datumkiezer (standaard vandaag); toont de gegenereerde of override-regel in woorden, de moeilijkheid (`difficultyOf`), het aantal items dat voldoet/niet voldoet, de voorbeelden uit `newGame`, en eventuele `Problem`s uit `validateRule`.
  - **Regelbouwer**: keuzelijsten voor eigenschap 1 (+ "niet"), optioneel "en" met eigenschap 2 (+ "niet"); toont direct de zin, moeilijkheid en problemen; knop "Sla op als override voor deze datum" is uitgeschakeld zolang er problemen zijn (`unknown-property`, `too-few-*`, `ambiguous`); knop "Verwijder override".
  - **Data**: items (naam, emoji, vinkjes per eigenschap, toevoegen/verwijderen) en eigenschappen (id, label, negLabel; verwijderen haalt ze ook uit alle items en meldt als een override ze gebruikt). Elke wijziging gaat via `POST /__portal/save`.
  - Banner: "Wijzig je data nadat de site live is, dan verschuiven toekomstige (en mogelijk huidige) puzzels. Zet de dag van vandaag vast met een override."

- [ ] **Step 1: Write the failing test** (`portalSave.test.ts`, tijdelijke map met `src/data/`): `applySave(tmp, 'overrides', {})` schrijft `{}`; `applySave(tmp, 'items', [])` schrijft `[]`; `applySave(tmp, '../evil', {})` en `applySave(tmp, 'package', {})` gooien en schrijven niets; `applySave(tmp, 'items', {})` (verkeerde vorm) gooit.
- [ ] **Step 2: Run** `npx vitest run tests/portalSave.test.ts` → FAIL.
- [ ] **Step 3: Implement** `applySave` en de plugin; daarna `portal/index.html` + `portal/portal.ts`.
- [ ] **Step 4: Run** de test → PASS. Verifieer handmatig met `npm run dev` en `/portal/index.html`: kies een datum, bouw een override, sla op, controleer dat `src/data/overrides.json` is aangepast, herlaad de hoofdpagina op die datum en zie de override; probeer een regel met te weinig items (opslaan geblokkeerd).
- [ ] **Step 5: Commit**: `git add -A; git commit -m "feat: local developer portal"`

---

### Task 10: Documentatie en publicatiecontrole

**Files:**
- Create: `README.md`
- Test: `tests/build.test.ts` (optioneel, maar aanbevolen)

- [ ] **Step 1: Write the check**: `npm run build` en controleer dat `dist/index.html` bestaat en `dist/portal` **niet** bestaat (shelltest of een Vitest-test die `fs.existsSync` gebruikt na een build).
- [ ] **Step 2: Run** de check → verwacht PASS; faalt `dist/portal`, dan haalt de bundelaar het portaal onbedoeld mee: corrigeer `vite.config.ts` zodat alleen `index.html` een build-ingang is.
- [ ] **Step 3: Write `README.md`** (Nederlands, kort): wat het spel is; `npm install`, `npm run dev`, `npm test`, `npm run build`; het portaal openen (`/portal/index.html` onder dev); `EPOCH` instellen vóór publicatie; waarschuwing dat itemdata aanpassen na publicatie toekomstige en mogelijk huidige puzzels verschuift en hoe een override dat vastzet; publiceren van de map `dist/` (bijvoorbeeld Netlify of GitHub Pages); hoe je later een andere `GuessMethod` toevoegt (nieuw bestand in `src/game/guess.ts`-stijl, doorgeven aan `startExam`/`submitExam`).
- [ ] **Step 4: Run** `npx vitest run; npm run build` → alles groen.
- [ ] **Step 5: Commit**: `git add -A; git commit -m "docs: README and build check"`
