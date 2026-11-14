import { describe, expect, it } from 'vitest';
import { checkDeterminism } from './determinism';
import { allStrings, LANGUAGES } from './languages';
import { decodeFromUrl, encodeForUrl, parseMachine, serializeMachine } from './parse';
import { accepts, explore, fmtDelta, fmtID, leaves, pathTo, primaryLeaf, verdict } from './pda';
import { ANB2N, ANBN, EQAB, PRESETS, WCWR, WWR } from './presets';
import { Machine } from './types';
import { traceLatex, traceText } from './trace';

/** IDs along the primary (accepting, if any) branch, formatted without spaces. */
function ids(m: Machine, w: string): string[] {
  const r = explore(m, w, m.mode);
  return pathTo(r, primaryLeaf(r)).map((id) => fmtID(r.nodes[id].config, w).replace(/\s+/g, ''));
}
const norm = (xs: string[]) => xs.map((s) => s.replace(/\s+/g, ''));

describe('brute force: every string up to length 8 is judged exactly by the language', () => {
  for (const p of PRESETS) {
    it(`${p.name} accepts exactly ${p.language}`, () => {
      const inL = LANGUAGES[p.id];
      const strs = allStrings(p.inputAlphabet, 8);
      let acceptedCount = 0;
      for (const w of strs) {
        const r = explore(p, w, p.mode);
        expect(r.complete, `search for "${w}" must be exhaustive`).toBe(true);
        expect(r.accepted, `"${w}"`).toBe(inL(w));
        if (r.accepted) acceptedCount++;
      }
      expect(acceptedCount).toBeGreaterThan(0);
    });
  }
});

describe('exact traces from the slides', () => {
  it('aⁿbⁿ on aabb: 5 moves, slides 10–12', () => {
    expect(ids(ANBN, 'aabb')).toEqual(norm([
      '(q0,aabb,Z)', '(q0,abb,XZ)', '(q0,bb,XXZ)', '(q1,b,XZ)', '(q1,ε,Z)', '(q2,ε,Z)',
    ]));
    const r = explore(ANBN, 'aabb', 'final');
    const v = verdict(r);
    expect(v.accepted).toBe(true);
    expect(v.reason).toBe('input consumed and q2 ∈ F');
    const path = pathTo(r, primaryLeaf(r));
    expect(path.slice(1).map((i) => fmtDelta(r.nodes[i].via!))).toEqual([
      'δ(q0, a, Z) = (q0, XZ)', 'δ(q0, a, X) = (q0, XX)', 'δ(q0, b, X) = (q1, ε)', 'δ(q1, b, X) = (q1, ε)', 'δ(q1, ε, Z) = (q2, Z)',
    ]);
    expect(r.linear).toBe(true);
  });

  it('aⁿbⁿ on aaabbb: 7 moves (slide 19)', () => {
    expect(ids(ANBN, 'aaabbb')).toEqual(norm([
      '(q0,aaabbb,Z)', '(q0,aabbb,XZ)', '(q0,abbb,XXZ)', '(q0,bbb,XXXZ)', '(q1,bb,XXZ)', '(q1,b,XZ)', '(q1,ε,Z)', '(q2,ε,Z)',
    ]));
  });

  it('aⁿbⁿ on aab ends at (q1, ε, XZ): stuck, reject', () => {
    const t = ids(ANBN, 'aab');
    expect(t[t.length - 1]).toBe('(q1,ε,XZ)');
    expect(t.length - 1).toBe(3);
    const v = verdict(explore(ANBN, 'aab', 'final'));
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain('input consumed but q1 ∉ F');
  });

  it('aⁿbⁿ on abab: reaches (q1, ab, Z), then the ε-move to q2, then stuck on a', () => {
    // NOTE: slide 16 stops at (q1,ab,Z), but δ(q1, ε, Z) = (q2, Z) still applies there.
    expect(ids(ANBN, 'abab')).toEqual(norm(['(q0,abab,Z)', '(q0,bab,XZ)', '(q1,ab,Z)', '(q2,ab,Z)']));
    const v = verdict(explore(ANBN, 'abab', 'final'));
    expect(v.accepted).toBe(false);
    expect(v.reason).toBe('stuck: no move from q2 on a with Z on top (and no ε-move)');
  });

  it('aⁿb²ⁿ on aabbbb: 7 moves (slide 24)', () => {
    expect(ids(ANB2N, 'aabbbb')).toEqual(norm([
      '(q0,aabbbb,Z)', '(q0,abbbb,XXZ)', '(q0,bbbb,XXXXZ)', '(q1,bbb,XXXZ)', '(q1,bb,XXZ)', '(q1,b,XZ)', '(q1,ε,Z)', '(q2,ε,Z)',
    ]));
  });

  it('wwᴿ on abba: 5 guesses, exactly one accepts (after 2 symbols), slide 19', () => {
    const r = explore(WWR, 'abba', 'empty');
    const ls = leaves(r).filter((n) => n.status !== 'repeat');
    expect(ls.length).toBe(5);
    expect(ls.filter((n) => n.status === 'accept').length).toBe(1);
    expect(ids(WWR, 'abba')).toEqual(norm([
      '(q1,abba,Z)', '(q1,bba,AZ)', '(q1,ba,BAZ)', '(q2,ba,BAZ)', '(q2,a,AZ)', '(q2,ε,Z)', '(q2,ε,ε)',
    ]));
    // the guess after 1 symbol: q2 with AZ and input bba — b cannot pop A
    const g1 = ls.find((n) => n.config.state === 'q2' && n.config.pos === 1);
    expect(g1?.config.stack).toBe('AZ');
    expect(g1?.status).toBe('stuck');
    expect(g1?.reason).toContain('no move from q2 on b with A on top');
    // which guess each leaf made = how many symbols were read before the ε, X → X move
    const guesses = ls.map((n) => {
      const p = pathTo(r, n.id);
      const sw = p.find((id) => r.nodes[id].via?.to === 'q2' && r.nodes[id].via?.from === 'q1')!;
      return { after: r.nodes[sw].config.pos, ok: n.status === 'accept' };
    }).sort((a, b) => a.after - b.after);
    expect(guesses).toEqual([0, 1, 2, 3, 4].map((after) => ({ after, ok: after === 2 })));
  });

  it('wwᴿ on abab: all five guesses fail', () => {
    const r = explore(WWR, 'abab', 'empty');
    const ls = leaves(r).filter((n) => n.status !== 'repeat');
    expect(ls.length).toBe(5);
    expect(r.accepted).toBe(false);
    expect(verdict(r).headline).toBe('REJECT');
  });

  it('#a = #b on abba: stack empties (slide 29)', () => {
    expect(ids(EQAB, 'abba')).toEqual(norm(['(q0,abba,Z)', '(q0,bba,PZ)', '(q0,ba,Z)', '(q0,a,NZ)', '(q0,ε,Z)', '(q0,ε,ε)']));
    expect(verdict(explore(EQAB, 'abba', 'empty')).reason).toContain('stack empty');
  });

  it('wcwᴿ on abcba is a single deterministic path', () => {
    const r = explore(WCWR, 'abcba', 'final');
    expect(r.linear).toBe(true);
    expect(ids(WCWR, 'abcba')).toEqual(norm(['(q0,abcba,Z)', '(q0,bcba,AZ)', '(q0,cba,BAZ)', '(q1,ba,BAZ)', '(q1,a,AZ)', '(q1,ε,Z)', '(q2,ε,Z)']));
  });
});

describe('acceptance modes judge the same run differently', () => {
  it('aⁿbⁿ by empty stack accepts nothing (Z is never popped)', () => {
    for (const w of allStrings(['a', 'b'], 6)) expect(accepts(ANBN, w, 'empty')).toBe(false);
  });
  it('#a = #b by final state accepts nothing (F = ∅)', () => {
    for (const w of allStrings(['a', 'b'], 6)) expect(accepts(EQAB, w, 'final')).toBe(false);
  });
  it('empty-stack verdict explains a non-empty stack', () => {
    const v = verdict(explore(ANBN, 'aabb', 'empty'));
    expect(v.accepted).toBe(false);
  });
});

describe('determinism checker', () => {
  it('machines 1–3 are deterministic', () => {
    for (const m of [ANBN, ANB2N, WCWR]) {
      const r = checkDeterminism(m);
      expect(r.deterministic, m.name).toBe(true);
      expect(r.violations).toEqual([]);
    }
  });
  it('wwᴿ violates Rule 2 (only) at (q1, A), (q1, B), (q1, Z)', () => {
    const r = checkDeterminism(WWR);
    expect(r.deterministic).toBe(false);
    expect(r.rule1).toBe(true);
    expect(r.rule2).toBe(false);
    expect(r.violations.map((v) => `${v.rule}:${v.state},${v.top}`).sort()).toEqual(['2:q1,A', '2:q1,B', '2:q1,Z']);
  });
  it('#a = #b violates Rule 2 (only) at (q0, Z)', () => {
    const r = checkDeterminism(EQAB);
    expect(r.rule1).toBe(true);
    expect(r.rule2).toBe(false);
    expect(r.violations.map((v) => `${v.rule}:${v.state},${v.top}`)).toEqual(['2:q0,Z']);
    expect(r.violations[0].message).toContain('Rule 2 fails at (q0, Z)');
  });
  it('detects a Rule 1 violation', () => {
    const { machine } = parseMachine('Q: q p\nSigma: a\nGamma: Z\nstart: q\nbottom: Z\nF: p\nq, a, Z -> q, Z | p, Z');
    const r = checkDeterminism(machine!);
    expect(r.rule1).toBe(false);
    expect(r.violations[0].rule).toBe(1);
  });
  it('slide-32 fragment satisfies Rule 1 and violates Rule 2', () => {
    const { machine } = parseMachine('Q: q p r\nSigma: a\nGamma: X Z\nstart: q\nbottom: Z\nF: p\nδ(q, ε, Z) = { (p, Z) }\nδ(q, a, Z) = { (r, XZ) }');
    const r = checkDeterminism(machine!);
    expect(r.rule1).toBe(true);
    expect(r.rule2).toBe(false);
  });
});

describe('search guards', () => {
  it('an ε-loop that grows the stack is cut off and reported', () => {
    const { machine } = parseMachine('Q: q\nSigma: a\nGamma: X Z\nstart: q\nbottom: Z\nF: \nmode: empty\nq, eps, Z -> q, XZ\nq, eps, X -> q, XX');
    const r = explore(machine!, 'a', 'empty', { maxSteps: 1000, maxStack: 30, maxBranches: 5000 });
    expect(r.complete).toBe(false);
    expect(r.guards.stack).toBeGreaterThan(0);
    expect(verdict(r).headline).toBe('REJECT?');
  });
  it('an ε-cycle that returns to the same configuration terminates via the visited set', () => {
    const { machine } = parseMachine('Q: p q\nSigma: a\nGamma: Z\nstart: p\nbottom: Z\nF: \nmode: empty\np, eps, Z -> q, Z\nq, eps, Z -> p, Z');
    const r = explore(machine!, 'a', 'empty');
    expect(r.complete).toBe(true);
    expect(r.accepted).toBe(false);
    expect(r.nodes.some((n) => n.status === 'repeat')).toBe(true);
  });
});

describe('parser and sharing', () => {
  it('round-trips every preset', () => {
    for (const p of PRESETS) {
      const { machine, errors } = parseMachine(serializeMachine(p));
      expect(errors).toEqual([]);
      expect(machine!.transitions.map(fmtDelta)).toEqual(p.transitions.map(fmtDelta));
      expect(machine!.mode).toBe(p.mode);
      const url = encodeForUrl(serializeMachine(p));
      expect(decodeFromUrl(url)).toBe(serializeMachine(p));
    }
  });
  it('gives friendly errors', () => {
    const { errors, warnings } = parseMachine('Q: q0\nSigma: a X\nGamma: X Z\nstart: q9\nbottom: Z\nF: q0\nq0, b, Z -> q0, XZ\nq0, a, Y -> q1, Z\nq0, a, eps -> q0, Z');
    const text = errors.map((e) => e.message).join('\n');
    expect(text).toContain('Start state "q9" is not in Q');
    expect(text).toContain('input symbol "b" is not in Σ');
    expect(text).toContain('top symbol "Y" is not in Γ');
    expect(text).toContain('unknown state "q1"');
    expect(text).toContain('cannot be ε');
    expect(warnings.map((w) => w.message).join()).toContain('Σ ∩ Γ');
  });
});

describe('trace export', () => {
  it('plain text and LaTeX', () => {
    const r = explore(ANBN, 'aabb', 'final');
    const lines = pathTo(r, primaryLeaf(r)).map((i) => ({ config: r.nodes[i].config, via: r.nodes[i].via }));
    const t = traceText(lines, 'aabb');
    expect(t).toContain('⊢ ( q0 , abb , XZ )');
    expect(t).toContain('δ(q0, a, Z) = (q0, XZ)');
    const l = traceLatex(lines, 'aabb');
    expect(l).toContain('\\vdash');
    expect(l).toContain('\\varepsilon');
  });
});

import { BUGS } from './bugs';
describe('fix-the-bug machines really show their symptoms', () => {
  it('each buggy machine misjudges its first test string, and the faulty index is right', () => {
    for (const b of BUGS) {
      const inL = LANGUAGES[b.base.id];
      const wrong = b.tests.filter((w) => accepts(b.machine, w, b.base.mode) !== inL(w));
      expect(wrong.length, b.title).toBeGreaterThan(0);
      expect(accepts(b.machine, b.tests[0], b.base.mode) !== inL(b.tests[0]), b.title).toBe(true);
      if (b.faulty >= 0) {
        // replacing the faulty transition by the original one repairs the machine
        const fixed = { ...b.machine, transitions: b.machine.transitions.map((t, i) => (i === b.faulty ? b.base.transitions[i] : t)) };
        for (const w of allStrings(b.base.inputAlphabet, 6)) expect(accepts(fixed, w, b.base.mode), `${b.title} ${w}`).toBe(inL(w));
      }
    }
  });
});

describe('reasons are always meaningful', () => {
  it('final-state judgement of an empty-stack machine explains the emptied stack', () => {
    const v = verdict(explore(WWR, 'abba', 'final'));
    expect(v.accepted).toBe(false);
    expect(v.reason).not.toContain('unreachable');
    expect(v.reason).toContain('∉ F');
  });
});

import { SLIDE_EXAMPLES } from './slideExamples';
import { firstEps } from './branchLabel';
describe('slide examples', () => {
  it('each example loads, its input is legal, and it gives the expected verdict', () => {
    for (const e of SLIDE_EXAMPLES) {
      if (!e.machine) continue;
      const w = e.input ?? '';
      for (const ch of w) expect(e.machine.inputAlphabet, e.id).toContain(ch);
      const r = explore(e.machine, w, e.mode ?? e.machine.mode);
      expect(r.complete, e.id).toBe(true);
      expect(r.accepted ? 'accept' : 'reject', e.id).toBe(e.expect);
      const { machine, errors } = parseMachine(serializeMachine(e.machine));
      expect(errors, e.id).toEqual([]);
      expect(machine!.transitions.length).toBe(e.machine.transitions.length);
      if (e.guessAfter !== undefined) {
        const leaf = leaves(r).find((n) => n.status !== 'repeat' && firstEps(r, n.id) === e.guessAfter);
        expect(leaf, e.id).toBeDefined();
      }
    }
  });
  it('the guess-after-1 branch is stuck exactly as slide 19 says', () => {
    const r = explore(WWR, 'abba', 'empty');
    const leaf = leaves(r).find((n) => firstEps(r, n.id) === 1)!;
    expect(leaf.status).toBe('stuck');
    expect(fmtID(leaf.config, 'abba').replace(/\s+/g, '')).toBe('(q2,bba,AZ)');
  });
  it('the extra ε-move for n = 0 breaks Rule 2 at (q0, Z)', async () => {
    const { ANBN_WITH_EPS, RULE2_FRAGMENT } = await import('./slideExamples');
    expect(checkDeterminism(ANBN_WITH_EPS).violations.map((v) => `${v.rule}:${v.state},${v.top}`)).toEqual(['2:q0,Z']);
    const f = checkDeterminism(RULE2_FRAGMENT);
    expect([f.rule1, f.rule2]).toEqual([true, false]);
  });
});
