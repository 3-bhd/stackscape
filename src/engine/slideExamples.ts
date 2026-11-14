import { ANB2N, ANBN, EQAB, T, WWR } from './presets';
import { AcceptMode, Machine } from './types';

/**
 * Every worked example in the Session 20 deck, ready to load with one click.
 * `expect` is checked by the unit tests so the examples can never drift from the engine.
 */
export interface SlideExample {
  id: string;
  slide: string;
  title: string;
  /** what to point at while it runs */
  look: string;
  view: 'lab' | 'multiverse' | 'compare' | 'mistakes';
  machine?: Machine;
  input?: string;
  mode?: AcceptMode;
  /** where the Lab should stop: a move number, or 'end' */
  step?: number | 'end';
  /** follow the branch whose ε-guess happened after this many symbols */
  guessAfter?: number;
  inspector?: boolean;
  expect?: 'accept' | 'reject';
}

/* Variants of slide machines used in the deck's questions */
export const ANBN_NO_TEST: Machine = {
  ...ANBN, id: 'custom', name: 'aⁿbⁿ without δ(q1, ε, Z)',
  transitions: ANBN.transitions.filter((t) => !(t.from === 'q1' && t.read === '')),
};
export const ANBN_WITH_EPS: Machine = {
  ...ANBN, id: 'custom', name: 'aⁿbⁿ, n ≥ 0 (adds δ(q0, ε, Z))', language: '{ aⁿbⁿ : n ≥ 0 }',
  transitions: T(['q0, a, Z -> q0, XZ', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps', 'q1, eps, Z -> q2, Z', 'q0, eps, Z -> q2, Z']),
};
export const RULE2_FRAGMENT: Machine = {
  id: 'custom', name: 'slide 32 fragment', language: '', mode: 'final',
  states: ['q', 'p', 'r'], inputAlphabet: ['a'], stackAlphabet: ['X', 'Z'], start: 'q', bottom: 'Z', finals: ['p'],
  transitions: T(['q, eps, Z -> p, Z', 'q, a, Z -> r, XZ']),
};

export const SLIDE_EXAMPLES: SlideExample[] = [
  {
    id: 'anbn-aabb', slide: 'Slides 9–12', title: 'aⁿbⁿ: full trace of aabb',
    look: 'Two pushes (Z → XZ → XXZ), two pops (XXZ → XZ → Z), then the ε-move δ(q1, ε, Z) = (q2, Z). Five moves for four symbols; ends at (q2, ε, Z) with q2 ∈ F.',
    view: 'lab', machine: ANBN, input: 'aabb', mode: 'final', step: 0, expect: 'accept',
  },
  {
    id: 'anbn-abab', slide: 'Slides 11 & 16', title: 'Why abab fails: stuck is rejection',
    look: 'The first b moves to q1. With Z on top, the ε-move to q2 still fires, then q2 has no move on a: stuck, so REJECT. (Slide 16 stops one line earlier, at (q1, ab, Z).)',
    view: 'lab', machine: ANBN, input: 'abab', mode: 'final', step: 'end', expect: 'reject',
  },
  {
    id: 'anbn-aab', slide: 'Slide 12', title: 'aab ends at (q1, ε, XZ)',
    look: 'Input is used up, but an X is still on the stack, so the ε-move on Z never fires. q1 ∉ F: reject.',
    view: 'lab', machine: ANBN, input: 'aab', mode: 'final', step: 'end', expect: 'reject',
  },
  {
    id: 'anbn-notest', slide: 'Slides 12 & 19', title: 'Delete δ(q1, ε, Z): L(M) = ∅',
    look: 'Same machine without the last transition. aabb reaches (q1, ε, Z) and stops: q2 is unreachable, so nothing is ever accepted. The last move is the acceptance test.',
    view: 'lab', machine: ANBN_NO_TEST, input: 'aabb', mode: 'final', step: 'end', expect: 'reject',
  },
  {
    id: 'compare', slide: 'Slide 13', title: 'wcwᴿ vs wwᴿ: the same machine twice',
    look: 'Left: the c is read, so the switch c, X → X is deterministic. Right: replace it by ε, X → X and the switch becomes a guess. Step both together.',
    view: 'compare',
  },
  {
    id: 'anbn-modes', slide: 'Slides 6 & 14', title: 'Same run, judged two ways',
    look: 'aⁿbⁿ on aabb under EMPTY STACK: the run still ends at (q2, ε, Z), but Z is on the stack, so N(M) rejects. Flip to final state and it accepts. Say which mode you use!',
    view: 'lab', machine: ANBN, input: 'aabb', mode: 'empty', step: 'end', expect: 'reject',
  },
  {
    id: 'eqab-abba', slide: 'Slides 14, 27–29', title: '#a = #b: one state, signed counter, abba',
    look: 'P for surplus a, N for surplus b, never both: Z → PZ → Z → NZ → Z, then ε, Z → ε empties the stack. Input consumed and stack empty: accept.',
    view: 'lab', machine: EQAB, input: 'abba', mode: 'empty', step: 0, expect: 'accept',
  },
  {
    id: 'eqab-det', slide: 'Slides 15 & 29–30', title: '#a = #b is not deterministic (Rule 2)',
    look: 'Rule 1 holds (every set has one element). Rule 2 fails at (q0, Z): δ(q0, ε, Z) ≠ ∅ while δ(q0, a, Z) and δ(q0, b, Z) are defined. Every empty-stack acceptor here breaks Rule 2 this way.',
    view: 'lab', machine: EQAB, input: 'abba', mode: 'empty', step: 'end', inspector: true, expect: 'accept',
  },
  {
    id: 'anbn-eps', slide: 'Slides 15 & 33', title: 'Admitting ε breaks determinism',
    look: 'To accept ε the machine needs δ(q0, ε, Z) = (q2, Z), but δ(q0, a, Z) is already defined: Rule 2 fails. The machine loses determinism; the language { aⁿbⁿ : n ≥ 0 } does not.',
    view: 'lab', machine: ANBN_WITH_EPS, input: '', mode: 'final', step: 'end', inspector: true, expect: 'accept',
  },
  {
    id: 'fragment', slide: 'Slides 15 & 32', title: 'Rule 1 holds, Rule 2 fails',
    look: 'δ(q, ε, Z) = {(p, Z)} and δ(q, a, Z) = {(r, XZ)}. Each set has one element, but in q with Z on top the machine may take the ε-move OR read a. On input a, both branches are explored.',
    view: 'lab', machine: RULE2_FRAGMENT, input: 'a', mode: 'final', step: 'end', inspector: true, expect: 'reject',
  },
  {
    id: 'mistakes', slide: 'Slide 16', title: 'Three ways a PDA answer goes wrong',
    look: 'Forgetting the bottom marker, writing the stack backwards (ZX instead of XZ), and treating stuck as an error. Each has a live wrong-vs-right demo.',
    view: 'mistakes',
  },
  {
    id: 'round1', slide: 'Slides 18–19, Round 1', title: 'aaabbb: seven moves, not six',
    look: 'Three pushes, three pops, one ε-move. Eight IDs, seven moves. Ask the room to predict first: most say six and forget the final ε-move.',
    view: 'lab', machine: ANBN, input: 'aaabbb', mode: 'final', step: 0, expect: 'accept',
  },
  {
    id: 'round2', slide: 'Slides 18–19, Round 2', title: 'wwᴿ on abba: five guesses, one accepts',
    look: 'Guesses after 0, 1, 2, 3, 4 symbols. Only the guess after 2 empties the stack. Press Play to watch the branches split and die.',
    view: 'multiverse', machine: WWR, input: 'abba', mode: 'empty', expect: 'accept',
  },
  {
    id: 'round2-good', slide: 'Slide 19', title: 'wwᴿ: the accepting branch (guess after 2)',
    look: '(q1, abba, Z) ⊢ (q1, bba, AZ) ⊢ (q1, ba, BAZ) ⊢ (q2, ba, BAZ) guess ⊢ (q2, a, AZ) ⊢ (q2, ε, Z) ⊢ (q2, ε, ε). Accept by empty stack.',
    view: 'lab', machine: WWR, input: 'abba', mode: 'empty', step: 0, guessAfter: 2, expect: 'accept',
  },
  {
    id: 'round2-bad', slide: 'Slide 19', title: 'wwᴿ: the guess after 1 is stuck',
    look: 'q2 with stack AZ and input bba: b cannot pop A. This branch is stuck, but the string is still accepted because another branch succeeds.',
    view: 'lab', machine: WWR, input: 'abba', mode: 'empty', step: 'end', guessAfter: 1, expect: 'accept',
  },
  {
    id: 'wwr-abab', slide: 'Slide 19 (early finishers)', title: 'wwᴿ on abab: every guess fails',
    look: 'All five branches get stuck. That is what rejection by a nondeterministic machine means: no branch accepts.',
    view: 'multiverse', machine: WWR, input: 'abab', mode: 'empty', expect: 'reject',
  },
  {
    id: 'anb2n', slide: 'Slides 21–25', title: 'aⁿb²ⁿ: trace aabbbb and check determinism',
    look: 'Each a pushes two X’s, each b pops one: seven moves. Rule 1 ✓, Rule 2 ✓ (the only ε-move is at (q1, Z), where nothing reads input), so it is deterministic.',
    view: 'lab', machine: ANB2N, input: 'aabbbb', mode: 'final', step: 0, inspector: true, expect: 'accept',
  },
];
