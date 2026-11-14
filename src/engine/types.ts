/**
 * Core PDA types, following CSCE 4201 Session 20 conventions:
 *   M = (Q, Σ, Γ, δ, q₀, Z₀, F)
 *   δ : Q × (Σ ∪ {ε}) × Γ → finite subsets of Q × Γ*
 *
 * Stack strings are written TOP FIRST (index 0 is the top), exactly like
 * the α in an instantaneous description (q, w, α).
 * Input and stack symbols are single characters.
 */

export const EPS = 'ε';

export type AcceptMode = 'final' | 'empty';

export interface Transition {
  /** stable id, e.g. "t3" */
  id: string;
  from: string;
  /** input symbol read, or '' for an ε-move */
  read: string;
  /** stack symbol that must be on top */
  top: string;
  to: string;
  /** γ: the string that REPLACES the top symbol, written top first. '' = pop */
  push: string;
}

export interface Machine {
  id: string;
  name: string;
  /** short language description, e.g. "{ aⁿbⁿ : n ≥ 1 }" */
  language: string;
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  start: string;
  bottom: string;
  finals: string[];
  transitions: Transition[];
  /** the acceptance mode the machine was designed for */
  mode: AcceptMode;
  description?: string;
}

/** An instantaneous description: (state, unread input, stack top-first). */
export interface Config {
  state: string;
  /** number of input symbols already consumed */
  pos: number;
  /** whole stack, top first */
  stack: string;
}

export type GammaKind = 'pop' | 'leave' | 'push' | 'replace';
