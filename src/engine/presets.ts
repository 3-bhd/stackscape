import { AcceptMode, Machine, Transition } from './types';

/** Build transitions from lines like "q0, a, Z -> q0, XZ" (eps = ε). */
export function T(lines: string[]): Transition[] {
  return lines.map((l, i) => {
    const [lhs, rhs] = l.split('->').map((s) => s.trim());
    const [from, read, top] = lhs.split(',').map((s) => s.trim());
    const [to, push] = rhs.split(',').map((s) => s.trim());
    const e = (s: string) => (s === 'eps' || s === 'ε' ? '' : s);
    return { id: `t${i}`, from, read: e(read), top, to, push: e(push) };
  });
}

export interface DemoString {
  input: string;
  note: string;
}

export interface Preset extends Machine {
  short: string;
  deterministic: boolean;
  demos: DemoString[];
  /** where it is in the slides */
  source: string;
  /** one paragraph explaining what the stack means */
  stackMeaning: string;
}

function mk(
  p: Omit<Preset, 'transitions'> & { rules: string[] },
): Preset {
  const { rules, ...rest } = p;
  return { ...rest, transitions: T(rules) };
}

export const ANBN: Preset = mk({
  id: 'anbn',
  name: 'aⁿbⁿ',
  short: 'aⁿbⁿ',
  language: '{ aⁿbⁿ : n ≥ 1 }',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['X', 'Z'],
  start: 'q0',
  bottom: 'Z',
  finals: ['q2'],
  mode: 'final' as AcceptMode,
  deterministic: true,
  source: 'Session 20, slides 8–12',
  stackMeaning:
    'The stack is a unary counter: one X per a still waiting for its b. The bottom marker Z is how the machine sees that the count is back to zero.',
  rules: [
    'q0, a, Z -> q0, XZ',
    'q0, a, X -> q0, XX',
    'q0, b, X -> q1, eps',
    'q1, b, X -> q1, eps',
    'q1, eps, Z -> q2, Z',
  ],
  demos: [
    { input: 'aabb', note: '5 moves · accept' },
    { input: 'aaabbb', note: '7 moves · accept' },
    { input: 'aab', note: 'ends at (q1, ε, XZ) · reject' },
    { input: 'abab', note: 'stuck · reject' },
  ],
});

export const ANB2N: Preset = mk({
  id: 'anb2n',
  name: 'aⁿb²ⁿ',
  short: 'aⁿb²ⁿ',
  language: '{ aⁿb²ⁿ : n ≥ 1 }',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['X', 'Z'],
  start: 'q0',
  bottom: 'Z',
  finals: ['q2'],
  mode: 'final' as AcceptMode,
  deterministic: true,
  source: 'Session 20, practice question 1 (slides 21–25)',
  stackMeaning:
    'The stack counts how many b’s are still owed: each a pushes TWO X’s, each b pops one. "When a ratio is involved, put it in the push rather than in the states."',
  rules: [
    'q0, a, Z -> q0, XXZ',
    'q0, a, X -> q0, XXX',
    'q0, b, X -> q1, eps',
    'q1, b, X -> q1, eps',
    'q1, eps, Z -> q2, Z',
  ],
  demos: [
    { input: 'aabbbb', note: '7 moves · accept' },
    { input: 'abb', note: '3 moves · accept' },
    { input: 'aabbb', note: 'one b short · reject' },
    { input: 'abbb', note: 'one b too many · reject' },
  ],
});

/* wcwᴿ — slide 13 rules, with X ranging over every stack symbol {A, B, Z}. */
const WCW_RULES: string[] = [];
for (const X of ['A', 'B', 'Z']) WCW_RULES.push(`q0, a, ${X} -> q0, A${X}`, `q0, b, ${X} -> q0, B${X}`);
for (const X of ['A', 'B', 'Z']) WCW_RULES.push(`q0, c, ${X} -> q1, ${X}`);
WCW_RULES.push('q1, a, A -> q1, eps', 'q1, b, B -> q1, eps', 'q1, eps, Z -> q2, Z');

export const WCWR: Preset = mk({
  id: 'wcwr',
  name: 'wcwᴿ',
  short: 'wcwᴿ',
  language: '{ w c wᴿ : w ∈ {a, b}* }',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a', 'b', 'c'],
  stackAlphabet: ['A', 'B', 'Z'],
  start: 'q0',
  bottom: 'Z',
  finals: ['q2'],
  mode: 'final' as AcceptMode,
  deterministic: true,
  source: 'Session 20, slide 13 (left)',
  stackMeaning:
    'The stack holds the symbols themselves (A for a, B for b), so it spells w backwards — exactly wᴿ, top first. The c says where the middle is, so the switch is a real input symbol and nothing is guessed.',
  rules: WCW_RULES,
  demos: [
    { input: 'abcba', note: 'accept' },
    { input: 'abbcbba', note: 'accept' },
    { input: 'c', note: 'w = ε · accept' },
    { input: 'abcab', note: 'mismatch · reject' },
  ],
});

/* wwᴿ — slides 13, 18, 19. States q1 (push) and q2 (match), as in the slide-19 trace. */
const WW_RULES: string[] = [];
for (const X of ['A', 'B', 'Z']) WW_RULES.push(`q1, a, ${X} -> q1, A${X}`, `q1, b, ${X} -> q1, B${X}`);
for (const X of ['A', 'B', 'Z']) WW_RULES.push(`q1, eps, ${X} -> q2, ${X}`);
WW_RULES.push('q2, a, A -> q2, eps', 'q2, b, B -> q2, eps', 'q2, eps, Z -> q2, eps');

export const WWR: Preset = mk({
  id: 'wwr',
  name: 'wwᴿ',
  short: 'wwᴿ',
  language: '{ w wᴿ : w ∈ {a, b}* }',
  states: ['q1', 'q2'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['A', 'B', 'Z'],
  start: 'q1',
  bottom: 'Z',
  finals: [],
  mode: 'empty' as AcceptMode,
  deterministic: false,
  source: 'Session 20, slides 13, 18, 19',
  stackMeaning:
    'Same stack as wcwᴿ — it spells what has been read, backwards. But with no c in the input, the switch ε, X → X is a GUESS that the middle has been reached. The machine tries every midpoint at once; one right guess is enough.',
  rules: WW_RULES,
  demos: [
    { input: 'abba', note: '5 guesses, 1 accepts' },
    { input: 'abab', note: 'all 5 guesses fail' },
    { input: 'aa', note: 'accept' },
    { input: 'baab', note: 'accept' },
  ],
});

export const EQAB: Preset = mk({
  id: 'eqab',
  name: '#a = #b',
  short: '#a = #b',
  language: '{ w ∈ {a, b}* : #a(w) = #b(w) }',
  states: ['q0'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['P', 'N', 'Z'],
  start: 'q0',
  bottom: 'Z',
  finals: [],
  mode: 'empty' as AcceptMode,
  deterministic: false,
  source: 'Session 20, practice question 2 (slides 26–30)',
  stackMeaning:
    'The stack is a SIGNED counter of f(w) = #a − #b: |f| copies of P when there are surplus a’s, |f| copies of N when there are surplus b’s, never both. One state is enough because the whole memory is on the stack.',
  rules: [
    'q0, a, Z -> q0, PZ',
    'q0, b, Z -> q0, NZ',
    'q0, a, P -> q0, PP',
    'q0, b, N -> q0, NN',
    'q0, a, N -> q0, eps',
    'q0, b, P -> q0, eps',
    'q0, eps, Z -> q0, eps',
  ],
  demos: [
    { input: 'abba', note: '5 moves · stack empties' },
    { input: 'aabbab', note: 'accept' },
    { input: 'aab', note: 'surplus +1 · reject' },
    { input: 'ba', note: 'accept' },
  ],
});

export const PRESETS: Preset[] = [ANBN, ANB2N, WCWR, WWR, EQAB];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
