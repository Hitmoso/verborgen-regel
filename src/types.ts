export type Property = { id: string; label: string; negLabel: string };
export type Item = { id: string; name: string; emoji: string; props: string[] }; // props = ids die waar zijn
export type Rule = { t: 'prop'; id: string } | { t: 'not'; r: Rule } | { t: 'and'; a: Rule; b: Rule };
export type Puzzle = { number: number; dateKey: string; rule: Rule; isOverride: boolean };
