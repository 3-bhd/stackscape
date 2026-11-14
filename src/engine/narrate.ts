import { gammaKind, pushedSymbols, showSym, unread } from './pda';
import { Config, Machine, Transition } from './types';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n: number) => (n < WORDS.length ? WORDS[n] : String(n));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, s: string) => `${num(n)} ${s}${n === 1 ? '' : '’s'}`;
const cnt = (s: string, ch: string) => [...s].filter((c) => c === ch).length;

/** "Read a with X on top: push X." — the mechanical half of the narration. */
export function describeMove(t: Transition): string {
  const head = t.read === '' ? `ε-move (head stays put) with ${t.top} on top` : `Read ${t.read} with ${t.top} on top`;
  const k = gammaKind(t);
  let op: string;
  if (k === 'pop') op = `pop ${t.top} (γ = ε)`;
  else if (k === 'leave') op = `leave the stack alone (γ = ${t.top})`;
  else if (k === 'push') op = `push ${pushedSymbols(t)} (γ = ${t.push})`;
  else op = `replace ${t.top} by ${t.push}`;
  const st = t.from === t.to ? '' : `, go to ${t.to}`;
  return `${head}: ${op}${st}.`;
}

/** Machine-specific insight about what the stack now means. */
export function insight(m: Machine, c: Config, input: string): string {
  const read = input.slice(0, c.pos);
  const s = c.stack;
  switch (m.id) {
    case 'anbn': {
      const a = cnt(read, 'a'), b = cnt(read, 'b'), x = cnt(s, 'X');
      if (c.state === 'q2') return 'The stack is back down to Z: the count reached zero — counts matched.';
      if (b === 0) return `${cap(plural(a, 'a'))} read, ${plural(x, 'X')} on the stack.`;
      return `${cap(plural(b, 'b'))} matched; ${plural(x, 'X')} still waiting for a b.`;
    }
    case 'anb2n': {
      const x = cnt(s, 'X');
      if (c.state === 'q2') return 'Back to Z: every a got exactly two b’s.';
      return `${cap(num(x))} b${x === 1 ? '' : '’s'} still owed (one X per owed b).`;
    }
    case 'wcwr':
    case 'wwr': {
      const body = s.replace(/Z$/, '');
      if (c.state === (m.id === 'wcwr' ? 'q0' : 'q1'))
        return body ? `Stack (top first) ${body} spells "${read}" backwards.` : 'Nothing pushed yet.';
      if (s === '') return 'Stack completely empty, bottom marker included.';
      return body ? `Still to match: ${body.toLowerCase()} must come next, in that order.` : 'Everything matched; only Z left.';
    }
    case 'eqab': {
      const f = cnt(read, 'a') - cnt(read, 'b');
      if (s === '') return 'Marker removed: the stack is completely empty.';
      if (f === 0) return 'f(w) = #a − #b = 0: only Z on the stack.';
      return `f(w) = #a − #b = ${f > 0 ? '+' : '−'}${Math.abs(f)}: ${num(Math.abs(f))} ${f > 0 ? 'P' : 'N'}${Math.abs(f) === 1 ? '' : '’s'} (surplus ${f > 0 ? 'a' : 'b'}’s).`;
    }
  }
  const rest = unread(input, c.pos);
  return `Unread: ${showSym(rest)}. Stack height ${s.length}.`;
}

export function narrate(m: Machine, t: Transition | null, c: Config, input: string): string {
  if (!t) return `Start: state ${m.start}, whole input unread, stack holds only the bottom marker ${m.bottom}.`;
  return `${describeMove(t)} ${insight(m, c, input)}`;
}
