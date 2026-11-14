import { showSym } from './pda';
import { AcceptMode, Machine, Transition } from './types';

/**
 * Text format for machines (one item per line, '#' starts a comment):
 *
 *   name: aⁿbⁿ
 *   Q: q0 q1 q2
 *   Sigma: a b
 *   Gamma: X Z
 *   start: q0
 *   bottom: Z
 *   F: q2
 *   mode: final            (or: empty)
 *   q0, a, Z -> q0, XZ
 *   q1, eps, Z -> q2, Z
 *
 * Also accepted: Σ Γ q₀ Z₀ as header names, ε / eps / λ for the empty string,
 * → for ->, several targets separated by |, and δ(q0, a, Z) = (q0, XZ) lines.
 */

export interface Issue {
  line: number; // 1-based, 0 = whole machine
  message: string;
}

export interface ParseResult {
  machine: Machine | null;
  errors: Issue[];
  warnings: Issue[];
}

const EPS_WORDS = new Set(['eps', 'ε', 'λ', 'Λ', 'epsilon', '']);

const HEADERS: Record<string, string> = {
  name: 'name', language: 'language', lang: 'language', l: 'language',
  q: 'Q', states: 'Q',
  sigma: 'Sigma', 'σ': 'Sigma', input: 'Sigma',
  gamma: 'Gamma', 'γ': 'Gamma', stack: 'Gamma',
  start: 'start', q0: 'start', 'q₀': 'start',
  bottom: 'bottom', z0: 'bottom', 'z₀': 'bottom',
  f: 'F', finals: 'F', final: 'F', accept: 'F',
  mode: 'mode', acceptance: 'mode',
};

function splitList(s: string): string[] {
  const t = s.trim().replace(/^\{|\}$/g, '').trim();
  if (t === '' || t === '∅') return [];
  return t.split(/[\s,]+/).filter(Boolean);
}

export function parseMachine(text: string): ParseResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const head: Record<string, { value: string; line: number }> = {};
  const rawT: { line: number; from: string; read: string; top: string; to: string; push: string }[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const s = raw.replace(/#.*$/, '').trim();
    if (!s) return;
    // δ(q, a, Z) = (p, γ)  or  δ(q,a,Z) = {(p,γ),(r,β)}
    const dm = s.match(/^δ\s*\(\s*([^,]+?)\s*,\s*([^,]*?)\s*,\s*([^)]+?)\s*\)\s*=\s*(.+)$/);
    if (dm) {
      const targets = [...dm[4].matchAll(/\(\s*([^,()]+?)\s*,\s*([^()]*?)\s*\)/g)];
      if (!targets.length) errors.push({ line, message: `Line ${line}: could not read the right-hand side "${dm[4]}". Write (p, γ).` });
      for (const tg of targets) rawT.push({ line, from: dm[1], read: dm[2], top: dm[3], to: tg[1], push: tg[2] });
      return;
    }
    const arrow = s.match(/^(.*?)\s*(?:->|→)\s*(.*)$/);
    if (arrow) {
      const lhs = arrow[1].split(',').map((x) => x.trim());
      if (lhs.length !== 3) {
        errors.push({ line, message: `Line ${line}: the left side needs exactly three parts "state, input, top" — got "${arrow[1]}".` });
        return;
      }
      for (const part of arrow[2].split('|')) {
        const rhs = part.split(',').map((x) => x.trim());
        if (rhs.length !== 2) {
          errors.push({ line, message: `Line ${line}: the right side needs "state, γ" (use eps for ε) — got "${part.trim()}".` });
          continue;
        }
        rawT.push({ line, from: lhs[0], read: lhs[1], top: lhs[2], to: rhs[0], push: rhs[1] });
      }
      return;
    }
    const hm = s.match(/^([^:=]+?)\s*[:=]\s*(.*)$/);
    if (hm) {
      const key = HEADERS[hm[1].trim().toLowerCase()] ?? HEADERS[hm[1].trim()];
      if (!key) {
        errors.push({ line, message: `Line ${line}: unknown header "${hm[1].trim()}". Known: name, Q, Sigma, Gamma, start, bottom, F, mode.` });
        return;
      }
      head[key] = { value: hm[2].trim(), line };
      return;
    }
    errors.push({ line, message: `Line ${line}: not understood. Transitions look like "q0, a, Z -> q0, XZ".` });
  });

  const need = (k: string, label: string) => {
    if (!head[k]) errors.push({ line: 0, message: `Missing "${label}:" line.` });
  };
  need('Q', 'Q'); need('Sigma', 'Sigma'); need('Gamma', 'Gamma'); need('start', 'start'); need('bottom', 'bottom');

  const states = head.Q ? splitList(head.Q.value) : [];
  const sigma = head.Sigma ? splitList(head.Sigma.value) : [];
  const gamma = head.Gamma ? splitList(head.Gamma.value) : [];
  const finals = head.F ? splitList(head.F.value) : [];
  const start = head.start?.value.trim() ?? '';
  const bottom = head.bottom?.value.trim() ?? '';
  let mode: AcceptMode = 'final';
  if (head.mode) {
    const v = head.mode.value.toLowerCase();
    if (v.startsWith('e') || v.includes('stack') || v === 'n') mode = 'empty';
    else if (v.startsWith('f') || v === 'l') mode = 'final';
    else errors.push({ line: head.mode.line, message: `mode must be "final" or "empty", got "${head.mode.value}".` });
  } else if (finals.length === 0) {
    mode = 'empty';
  }

  const dupCheck = (xs: string[], what: string, line: number) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x)) warnings.push({ line, message: `${what}: "${x}" listed twice.` });
      seen.add(x);
    }
  };
  if (head.Q) dupCheck(states, 'Q', head.Q.line);
  for (const [xs, k, nm] of [[sigma, 'Sigma', 'Σ'], [gamma, 'Gamma', 'Γ']] as const) {
    for (const x of xs) {
      if ([...x].length !== 1) errors.push({ line: head[k].line, message: `${nm} symbol "${x}" must be a single character (so that γ = XZ can be read symbol by symbol).` });
      if (EPS_WORDS.has(x)) errors.push({ line: head[k].line, message: `${nm} cannot contain ε — ε means "no symbol".` });
    }
  }
  if (head.Gamma && !head.Gamma.value.trim()) errors.push({ line: head.Gamma.line, message: 'Γ must contain at least the bottom marker.' });
  const overlap = sigma.filter((x) => gamma.includes(x));
  if (overlap.length) {
    warnings.push({ line: head.Gamma?.line ?? 0, message: `Σ ∩ Γ = {${overlap.join(', ')}} — legal, but by convention Σ ∩ Γ = ∅ and overlapping alphabets make traces confusing.` });
  }
  if (head.start && !states.includes(start)) errors.push({ line: head.start.line, message: `Start state "${start}" is not in Q.` });
  if (head.bottom && !gamma.includes(bottom)) errors.push({ line: head.bottom.line, message: `Bottom marker "${bottom}" is not in Γ.` });
  for (const f of finals) if (!states.includes(f)) errors.push({ line: head.F.line, message: `Final state "${f}" is not in Q.` });
  if (mode === 'final' && finals.length === 0) warnings.push({ line: head.F?.line ?? 0, message: 'Final-state mode with F = ∅: this machine accepts nothing.' });

  const transitions: Transition[] = [];
  const seenT = new Set<string>();
  for (const r of rawT) {
    const { line } = r;
    let ok = true;
    const read = EPS_WORDS.has(r.read) ? '' : r.read;
    const push = EPS_WORDS.has(r.push) ? '' : r.push.replace(/\s+/g, '');
    if (!states.includes(r.from)) { errors.push({ line, message: `Line ${line}: unknown state "${r.from}" (not in Q).` }); ok = false; }
    if (!states.includes(r.to)) { errors.push({ line, message: `Line ${line}: unknown state "${r.to}" (not in Q).` }); ok = false; }
    if (read !== '' && !sigma.includes(read)) {
      errors.push({ line, message: gamma.includes(read) && !sigma.includes(read)
        ? `Line ${line}: "${read}" is a stack symbol, not an input symbol. The middle part is what is READ from the input.`
        : `Line ${line}: input symbol "${read}" is not in Σ (use eps for an ε-move).` });
      ok = false;
    }
    if (!gamma.includes(r.top)) {
      errors.push({ line, message: EPS_WORDS.has(r.top)
        ? `Line ${line}: a move always looks at the top symbol — it cannot be ε. (An empty stack has no moves.)`
        : `Line ${line}: top symbol "${r.top}" is not in Γ.` });
      ok = false;
    }
    for (const ch of [...push]) {
      if (!gamma.includes(ch)) { errors.push({ line, message: `Line ${line}: γ = "${push}" uses "${ch}", which is not in Γ.` }); ok = false; break; }
    }
    if (!ok) continue;
    const key = `${r.from}|${read}|${r.top}|${r.to}|${push}`;
    if (seenT.has(key)) { warnings.push({ line, message: `Line ${line}: duplicate transition ignored.` }); continue; }
    seenT.add(key);
    transitions.push({ id: `t${transitions.length}`, from: r.from, read, top: r.top, to: r.to, push });
  }
  if (rawT.length === 0) warnings.push({ line: 0, message: 'No transitions: every run is stuck at once.' });

  if (errors.length) return { machine: null, errors, warnings };
  return {
    machine: {
      id: 'custom',
      name: head.name?.value || 'Custom machine',
      language: head.language?.value || '',
      states, inputAlphabet: sigma, stackAlphabet: gamma, start, bottom, finals, transitions, mode,
    },
    errors, warnings,
  };
}

export function serializeMachine(m: Machine): string {
  const lines = [
    `name: ${m.name}`,
    ...(m.language ? [`language: ${m.language}`] : []),
    `Q: ${m.states.join(' ')}`,
    `Sigma: ${m.inputAlphabet.join(' ')}`,
    `Gamma: ${m.stackAlphabet.join(' ')}`,
    `start: ${m.start}`,
    `bottom: ${m.bottom}`,
    `F: ${m.finals.length ? m.finals.join(' ') : '∅'}`,
    `mode: ${m.mode}`,
    '',
    ...m.transitions.map((t) => `${t.from}, ${t.read === '' ? 'eps' : t.read}, ${t.top} -> ${t.to}, ${t.push === '' ? 'eps' : t.push}`),
  ];
  return lines.join('\n');
}

/* URL sharing: base64url of the UTF-8 text */
export function encodeForUrl(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeFromUrl(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export { showSym };
