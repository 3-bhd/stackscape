import { ANB2N, ANBN, EQAB, Preset, T, WCWR } from './presets';
import { Machine } from './types';

/** Broken machines for the "Fix the bug" challenge. */
export interface Bug {
  title: string;
  base: Preset;
  machine: Machine;
  symptom: string;
  tests: string[];
  /** index of the faulty transition in machine.transitions, or -1 for "missing" */
  faulty: number;
  candidates?: string[];
  correctCandidate?: number;
  explain: string;
}

const bugMachine = (base: Preset, rules: string[], name: string): Machine => ({ ...base, id: 'bug', name, transitions: T(rules) });

export const BUGS: Bug[] = [
  {
    title: 'Stack written the wrong way round', base: ANBN,
    machine: bugMachine(ANBN, ['q0, a, Z -> q0, ZX', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps', 'q1, eps, Z -> q2, Z'], 'aⁿbⁿ (buggy)'),
    symptom: 'aabb is rejected — the machine gets stuck on the first b.', tests: ['aabb', 'ab'], faulty: 0,
    explain: 'δ(q0, a, Z) = (q0, ZX) leaves Z on TOP (the stack is written top first). The next move then sees Z, not X. Fix: (q0, XZ).',
  },
  {
    title: 'Forgotten bottom-marker test', base: ANBN,
    machine: bugMachine(ANBN, ['q0, a, Z -> q0, XZ', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps', 'q1, eps, X -> q2, X'], 'aⁿbⁿ (buggy)'),
    symptom: 'aab is ACCEPTED and aabb is rejected.', tests: ['aab', 'aabb'], faulty: 4,
    explain: 'The acceptance test must check that the count reached zero, i.e. that the bottom marker Z is on top. δ(q1, ε, X) fires while X’s are still owed. Fix: δ(q1, ε, Z) = (q2, Z).',
  },
  {
    title: 'Missing final ε-move', base: ANBN,
    machine: bugMachine(ANBN, ['q0, a, Z -> q0, XZ', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps'], 'aⁿbⁿ (buggy)'),
    symptom: 'Nothing is ever accepted: L(M) = ∅.', tests: ['aabb', 'ab'], faulty: -1,
    candidates: ['δ(q1, ε, Z) = (q2, Z)', 'δ(q1, b, Z) = (q2, Z)', 'δ(q0, ε, Z) = (q2, Z)', 'δ(q1, ε, X) = (q2, ε)'], correctCandidate: 0,
    explain: 'Without δ(q1, ε, Z) = (q2, Z), q2 is unreachable and L(M) = ∅. That last ε-move is not bookkeeping — it is the test that the two counts matched (slide 12).',
  },
  {
    title: 'Ratio in the wrong place', base: ANB2N,
    machine: bugMachine(ANB2N, ['q0, a, Z -> q0, XXZ', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps', 'q1, eps, Z -> q2, Z'], 'aⁿb²ⁿ (buggy)'),
    symptom: 'aabbbb is rejected but aabbb is accepted.', tests: ['aabbbb', 'aabbb'], faulty: 1,
    explain: 'Every a must leave TWO X’s to be cancelled. δ(q0, a, X) = (q0, XX) adds only one (it replaces X by XX). Fix: (q0, XXX).',
  },
  {
    title: 'A marker that eats a symbol', base: WCWR,
    machine: bugMachine(WCWR, WCWR.transitions.map((t) => `${t.from}, ${t.read || 'eps'}, ${t.top} -> ${t.to}, ${t.from === 'q0' && t.read === 'c' && t.top === 'A' ? 'eps' : t.push || 'eps'}`), 'wcwᴿ (buggy)'),
    symptom: 'bacab is rejected, though abcba is accepted.', tests: ['bacab', 'abcba'], faulty: 6,
    explain: 'The switch must leave the stack alone: c, X → X. δ(q0, c, A) = (q1, ε) pops the A that the matching phase needs. Fix: (q1, A).',
  },
  {
    title: 'Signed counter with the wrong sign', base: EQAB,
    machine: bugMachine(EQAB, ['q0, a, Z -> q0, PZ', 'q0, b, Z -> q0, NZ', 'q0, a, P -> q0, PP', 'q0, b, N -> q0, NN', 'q0, a, N -> q0, NN', 'q0, b, P -> q0, eps', 'q0, eps, Z -> q0, eps'], '#a = #b (buggy)'),
    symptom: 'ab is accepted but ba is rejected.', tests: ['ba', 'ab'], faulty: 4,
    explain: 'Reading an a with N on top must CANCEL a surplus b, not add another N: P’s and N’s never coexist. Fix: δ(q0, a, N) = (q0, ε).',
  },
];

