import { AcceptMode, Config, EPS, GammaKind, Machine, Transition } from './types';

/* ------------------------------------------------------------------ */
/* Formatting in course notation                                        */
/* ------------------------------------------------------------------ */

export const showSym = (s: string) => (s === '' ? EPS : s);

export function unread(input: string, pos: number): string {
  return input.slice(pos);
}

/** ( q0 , aabb , Z ) — stack top first */
export function fmtID(c: Config, input: string): string {
  return `( ${c.state} , ${showSym(unread(input, c.pos))} , ${showSym(c.stack)} )`;
}

/** δ(q0, a, Z) = (q0, XZ) */
export function fmtDelta(t: Transition): string {
  return `δ(${t.from}, ${showSym(t.read)}, ${t.top}) = (${t.to}, ${showSym(t.push)})`;
}

/** a, X → XX  (diagram label) */
export function fmtArrow(t: Transition): string {
  return `${showSym(t.read)}, ${t.top} → ${showSym(t.push)}`;
}

export function configKey(c: Config): string {
  return `${c.state}|${c.pos}|${c.stack}`;
}

/** Classify γ: the single operation "replace top by γ" in its three named forms. */
export function gammaKind(t: Transition): GammaKind {
  if (t.push === '') return 'pop';
  if (t.push === t.top) return 'leave';
  if (t.push.length > 1 && t.push.endsWith(t.top)) return 'push';
  return 'replace';
}

/** The symbols placed above the old top by a 'push' γ (top first). */
export function pushedSymbols(t: Transition): string {
  return gammaKind(t) === 'push' ? t.push.slice(0, -1) : '';
}

/* ------------------------------------------------------------------ */
/* One move                                                             */
/* ------------------------------------------------------------------ */

export interface Move {
  t: Transition;
  next: Config;
}

/** Every move available from configuration c (input-reading and ε-moves). */
export function moves(m: Machine, c: Config, input: string): Move[] {
  if (c.stack.length === 0) return []; // nothing on top: no transition can apply
  const top = c.stack[0];
  const a = c.pos < input.length ? input[c.pos] : null;
  const out: Move[] = [];
  for (const t of m.transitions) {
    if (t.from !== c.state || t.top !== top) continue;
    if (t.read === '') {
      out.push({ t, next: { state: t.to, pos: c.pos, stack: t.push + c.stack.slice(1) } });
    } else if (a !== null && t.read === a) {
      out.push({ t, next: { state: t.to, pos: c.pos + 1, stack: t.push + c.stack.slice(1) } });
    }
  }
  return out;
}

export function initialConfig(m: Machine): Config {
  return { state: m.start, pos: 0, stack: m.bottom };
}

export function isAccepting(m: Machine, c: Config, input: string, mode: AcceptMode): boolean {
  if (c.pos !== input.length) return false;
  return mode === 'final' ? m.finals.includes(c.state) : c.stack.length === 0;
}

/** Why an accepting configuration accepts, in course terms. */
export function acceptReason(m: Machine, c: Config, mode: AcceptMode): string {
  return mode === 'final'
    ? `input consumed and ${c.state} ∈ F`
    : `input consumed and stack empty (bottom marker ${m.bottom} included)`;
}

/** Why a configuration with no moves rejects, in course terms. */
export function stuckReason(m: Machine, c: Config, input: string, mode: AcceptMode): string {
  const rest = unread(input, c.pos);
  if (c.stack.length === 0) {
    return rest.length
      ? `stuck: the stack is empty, so no move is possible — and ${rest} is still unread`
      : `stack empty but … (unreachable)`;
  }
  const top = c.stack[0];
  if (rest.length) {
    return `stuck: no move from ${c.state} on ${rest[0]} with ${top} on top (and no ε-move)`;
  }
  if (mode === 'final') {
    return `input consumed but ${c.state} ∉ F, and no ε-move from ${c.state} with ${top} on top`;
  }
  return `input consumed but stack not empty (${c.stack}), and no ε-move from ${c.state} with ${top} on top`;
}

/* ------------------------------------------------------------------ */
/* Nondeterministic search: BFS over configurations                     */
/* ------------------------------------------------------------------ */

export type NodeStatus = 'accept' | 'stuck' | 'open' | 'inner' | 'repeat' | 'cut';

export interface RunNode {
  id: number;
  parent: number | null;
  config: Config;
  via: Transition | null;
  depth: number;
  children: number[];
  status: NodeStatus;
  reason: string;
}

export interface Limits {
  /** maximum number of moves along any one branch */
  maxSteps: number;
  /** maximum stack height */
  maxStack: number;
  /** maximum number of configurations explored in total */
  maxBranches: number;
}

export const DEFAULT_LIMITS: Limits = { maxSteps: 400, maxStack: 120, maxBranches: 6000 };

export interface Guards {
  steps: number;
  stack: number;
  branches: number;
}

export interface RunResult {
  machine: Machine;
  input: string;
  mode: AcceptMode;
  nodes: RunNode[];
  accepted: boolean;
  acceptIds: number[];
  /** how many branches each guard cut off */
  guards: Guards;
  /** true when no guard fired: the search was exhaustive */
  complete: boolean;
  /** true when the computation never had a choice */
  linear: boolean;
}

export function explore(
  m: Machine,
  input: string,
  mode: AcceptMode,
  limits: Limits = DEFAULT_LIMITS,
  opts: { stopAtFirstAccept?: boolean } = {},
): RunResult {
  const nodes: RunNode[] = [];
  const guards: Guards = { steps: 0, stack: 0, branches: 0 };
  const visited = new Set<string>();
  const root: RunNode = {
    id: 0, parent: null, config: initialConfig(m), via: null, depth: 0, children: [], status: 'open', reason: '',
  };
  nodes.push(root);
  visited.add(configKey(root.config));
  const queue: number[] = [0];
  const acceptIds: number[] = [];
  let head = 0;
  let linear = true;

  while (head < queue.length) {
    const node = nodes[queue[head++]];
    const c = node.config;
    if (isAccepting(m, c, input, mode)) {
      node.status = 'accept';
      node.reason = acceptReason(m, c, mode);
      acceptIds.push(node.id);
      if (opts.stopAtFirstAccept) break;
      continue;
    }
    const ms = moves(m, c, input);
    if (ms.length === 0) {
      node.status = 'stuck';
      node.reason = stuckReason(m, c, input, mode);
      continue;
    }
    if (ms.length > 1) linear = false;
    if (node.depth >= limits.maxSteps) {
      node.status = 'cut';
      node.reason = `search guard: branch reached the ${limits.maxSteps}-move limit`;
      guards.steps++;
      continue;
    }
    node.status = 'inner';
    for (const mv of ms) {
      const child: RunNode = {
        id: nodes.length, parent: node.id, config: mv.next, via: mv.t, depth: node.depth + 1,
        children: [], status: 'open', reason: '',
      };
      if (nodes.length >= limits.maxBranches) {
        node.status = 'cut';
        node.reason = `search guard: ${limits.maxBranches} configurations explored`;
        guards.branches++;
        break;
      }
      nodes.push(child);
      node.children.push(child.id);
      const key = configKey(mv.next);
      if (visited.has(key)) {
        child.status = 'repeat';
        child.reason = 'this configuration was already explored on another branch (or this one) — not repeated';
        continue;
      }
      visited.add(key);
      if (mv.next.stack.length > limits.maxStack) {
        child.status = 'cut';
        child.reason = `search guard: stack height exceeded ${limits.maxStack}`;
        guards.stack++;
        continue;
      }
      queue.push(child.id);
    }
  }
  // anything left open (stopAtFirstAccept or branch guard) is unexplored
  for (const n of nodes) {
    if (n.status === 'open') {
      n.status = 'cut';
      if (!n.reason) n.reason = opts.stopAtFirstAccept ? 'not explored (already accepted)' : 'search guard: not explored';
      if (!opts.stopAtFirstAccept) guards.branches++;
    }
  }
  const complete = guards.steps + guards.stack + guards.branches === 0;
  return { machine: m, input, mode, nodes, accepted: acceptIds.length > 0, acceptIds, guards, complete, linear };
}

export function accepts(m: Machine, input: string, mode: AcceptMode = m.mode, limits?: Limits): boolean {
  return explore(m, input, mode, limits, { stopAtFirstAccept: true }).accepted;
}

/** Root-to-node list of node ids. */
export function pathTo(r: RunResult, id: number): number[] {
  const out: number[] = [];
  let cur: number | null = id;
  while (cur !== null) {
    out.push(cur);
    cur = r.nodes[cur].parent;
  }
  return out.reverse();
}

export function leaves(r: RunResult): RunNode[] {
  return r.nodes.filter((n) => n.children.length === 0);
}

/** The branch the main panels follow: first accepting one, else the one that got furthest. */
export function primaryLeaf(r: RunResult): number {
  if (r.acceptIds.length) return r.acceptIds[0];
  let best = r.nodes[0];
  for (const n of leaves(r)) {
    if (n.status === 'repeat') continue;
    if (n.config.pos > best.config.pos || (n.config.pos === best.config.pos && n.depth > best.depth)) best = n;
  }
  return best.id;
}

export interface Verdict {
  accepted: boolean;
  headline: string;
  reason: string;
  /** extra lines: e.g. guard warnings, branch counts */
  notes: string[];
}

export function verdict(r: RunResult, leafId: number = primaryLeaf(r)): Verdict {
  const notes: string[] = [];
  const ls = leaves(r).filter((n) => n.status !== 'repeat');
  if (!r.linear) {
    const acc = ls.filter((n) => n.status === 'accept').length;
    notes.push(`${ls.length} branch${ls.length === 1 ? '' : 'es'} explored, ${acc} accepting. Accepted iff SOME branch accepts.`);
  }
  if (!r.complete) {
    const g = r.guards;
    const parts = [];
    if (g.steps) parts.push(`${g.steps} branch(es) hit the move limit`);
    if (g.stack) parts.push(`${g.stack} branch(es) hit the stack-height limit`);
    if (g.branches) parts.push(`the configuration limit stopped the search`);
    notes.push(`Search guard fired: ${parts.join('; ')}.`);
  }
  if (r.accepted) {
    const n = r.nodes[r.acceptIds[0]];
    return { accepted: true, headline: 'ACCEPT', reason: n.reason, notes };
  }
  if (!r.complete) {
    return {
      accepted: false,
      headline: 'REJECT?',
      reason: 'no accepting branch found within the search limits — the search was cut off, so this is not a proof of rejection',
      notes,
    };
  }
  const leaf = r.nodes[leafId];
  const reason = r.linear ? leaf.reason : `every branch rejects — e.g. ${leaf.reason}`;
  return { accepted: false, headline: 'REJECT', reason, notes };
}
