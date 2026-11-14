import { fmtDelta, showSym } from './pda';
import { Machine, Transition } from './types';

/**
 * Determinism rules from Session 20, slide 15:
 *   Rule 1: |δ(q, a, Z)| ≤ 1 for every q, Z and every a ∈ Σ ∪ {ε}.
 *   Rule 2: if δ(q, ε, Z) ≠ ∅ then δ(q, a, Z) = ∅ for every a ∈ Σ.
 */
export interface Violation {
  rule: 1 | 2;
  state: string;
  top: string;
  /** for rule 1: the input symbol (or '' for ε) whose set has > 1 element */
  read?: string;
  transitions: Transition[];
  message: string;
}

export interface DeterminismReport {
  deterministic: boolean;
  rule1: boolean;
  rule2: boolean;
  violations: Violation[];
  summary: string;
}

export function checkDeterminism(m: Machine): DeterminismReport {
  const violations: Violation[] = [];
  const groups = new Map<string, Transition[]>();
  for (const t of m.transitions) {
    const k = `${t.from}\u0000${t.read}\u0000${t.top}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  // Rule 1
  for (const ts of groups.values()) {
    if (ts.length > 1) {
      const t = ts[0];
      violations.push({
        rule: 1, state: t.from, top: t.top, read: t.read, transitions: ts,
        message: `Rule 1 fails at (${t.from}, ${showSym(t.read)}, ${t.top}): |δ(${t.from}, ${showSym(t.read)}, ${t.top})| = ${ts.length} > 1 — the machine has a choice of move.`,
      });
    }
  }
  // Rule 2
  const pairs = new Set(m.transitions.map((t) => `${t.from}\u0000${t.top}`));
  for (const p of pairs) {
    const [q, Z] = p.split('\u0000');
    const eps = m.transitions.filter((t) => t.from === q && t.top === Z && t.read === '');
    const reads = m.transitions.filter((t) => t.from === q && t.top === Z && t.read !== '');
    if (eps.length && reads.length) {
      const syms = [...new Set(reads.map((t) => t.read))].join(', ');
      violations.push({
        rule: 2, state: q, top: Z, transitions: [...eps, ...reads],
        message: `Rule 2 fails at (${q}, ${Z}): δ(${q}, ε, ${Z}) ≠ ∅ but δ(${q}, ${syms}, ${Z}) ≠ ∅ too — with ${Z} on top in ${q} the machine may take the ε-move OR read input, and nothing decides between them.`,
      });
    }
  }
  const rule1 = !violations.some((v) => v.rule === 1);
  const rule2 = !violations.some((v) => v.rule === 2);
  const deterministic = rule1 && rule2;
  let summary: string;
  if (deterministic) summary = 'DETERMINISTIC: Rule 1 ✓ (every δ(q, a, Z) has at most one element) and Rule 2 ✓ (every ε-move is the only move at its (q, Z)).';
  else if (!rule1 && !rule2) summary = 'NONDETERMINISTIC: both Rule 1 and Rule 2 fail.';
  else if (!rule1) summary = 'NONDETERMINISTIC: Rule 1 fails (Rule 2 holds).';
  else summary = 'NONDETERMINISTIC: Rule 2 fails (Rule 1 holds — every set has at most one element).';
  return { deterministic, rule1, rule2, violations, summary };
}

export function violationLines(v: Violation): string[] {
  return v.transitions.map(fmtDelta);
}
