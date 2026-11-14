import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { fmtID, leaves, pathTo, RunNode, RunResult, showSym } from '../engine/pda';
import { PRESETS } from '../engine/presets';
import { AcceptMode, Machine } from '../engine/types';
import { IDText, VerdictBox } from '../ui/Panels';
import { StackTower } from '../ui/StackTower';
import { Sim } from '../ui/useSim';

const COLW = 74;
const ROWH = 46;

const statusColor = (s: RunNode['status']) =>
  s === 'accept' ? 'var(--accept)' : s === 'stuck' ? 'var(--reject)' : s === 'repeat' ? 'var(--dim)' : s === 'cut' ? 'var(--amber)' : 'var(--cyan)';

export function firstEps(run: RunResult, leafId: number): number {
  for (const id of pathTo(run, leafId)) {
    const n = run.nodes[id];
    if (n.via?.read === '' && n.parent !== null) return run.nodes[n.parent].config.pos;
  }
  return Infinity;
}

export function branchLabel(run: RunResult, leafId: number): string {
  const k = firstEps(run, leafId);
  if (k === Infinity) return 'no ε-move';
  return `${run.machine.id === 'wwr' ? 'guess' : 'first ε-move'} after ${k} symbol${k === 1 ? '' : 's'}`;
}

interface Props {
  machine: Machine;
  input: string;
  mode: AcceptMode;
  sim: Sim;
  setInput: (s: string) => void;
  pickPreset: (id: string) => void;
  goto: (v: string) => void;
}

export function Multiverse({ machine, input, sim, setInput, pickPreset, goto }: Props) {
  const run = sim.run;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [draft, setDraft] = useState(input);
  useEffect(() => setDraft(input), [input]);

  const layout = useMemo(() => {
    if (!run) return null;
    const shownNodes = run.nodes.slice(0, 600);
    const ok = new Set(shownNodes.map((n) => n.id));
    const y = new Map<number, number>();
    let lane = 0;
    const visit = (id: number): number => {
      const n = run.nodes[id];
      const kids = n.children.filter((c) => ok.has(c));
      if (!kids.length) { const v = lane++ * ROWH; y.set(id, v); return v; }
      const ys = kids.map(visit);
      const v = (Math.min(...ys) + Math.max(...ys)) / 2;
      y.set(id, v);
      return v;
    };
    visit(0);
    const maxDepth = Math.max(...shownNodes.map((n) => n.depth));
    return { y, lanes: lane, maxDepth, nodes: shownNodes, truncated: run.nodes.length > shownNodes.length };
  }, [run]);

  useEffect(() => { setT(layout?.maxDepth ?? 0); setPlaying(false); }, [layout]);
  useEffect(() => {
    if (!playing || !layout) return;
    if (t >= layout.maxDepth) { setPlaying(false); return; }
    const h = setTimeout(() => setT((x) => x + 1), 650);
    return () => clearTimeout(h);
  }, [playing, t, layout]);

  if (!run || !layout) return <div className="panel err">Can’t run: {sim.problem}</div>;

  const ls = leaves(run).filter((n) => n.status !== 'repeat').slice(0, 30).sort((a, b) => firstEps(run, a.id) - firstEps(run, b.id));
  const W = (layout.maxDepth + 1) * COLW + 60;
  const H = Math.max(1, layout.lanes) * ROWH + 20;

  const nodeAt = (leaf: RunNode, time: number): RunNode => {
    const p = pathTo(run, leaf.id);
    return run.nodes[p[Math.min(time, p.length - 1)]];
  };

  const open = (id: number) => { sim.selectLeaf(id); goto('lab'); };
  const wwrHint = machine.id === 'wwr';

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Multiverse ⑂ <span className="muted" style={{ fontSize: '1rem' }}>— nondeterminism, all branches at once</span></h1>
          <p>When the machine has a choice, the run splits. Every branch is a full computation with its own stack. The string is accepted if <b>SOME</b> branch accepts; it is rejected only when <b>every</b> branch is stuck.</p>
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setInput(draft.replace(/\s+/g, '')); }}>
          {PRESETS.map((p) => (
            <button type="button" key={p.id} className="chip" aria-pressed={machine.id === p.id} onClick={() => pickPreset(p.id)}>{p.short}</button>
          ))}
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 120, fontFamily: 'var(--mono)' }} aria-label="input string" />
          <button className="btn primary small">Run</button>
        </form>
      </div>

      {run.linear && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <b className="ok">One branch only.</b> <span className="muted">{machine.name} never had a choice on “{showSym(input)}” — the multiverse is a single timeline. Try <button className="chip" onClick={() => pickPreset('wwr')}>wwᴿ</button> on abba.</span>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-title">
          <b>Branch tree · time →</b>
          <span>{ls.length} branch{ls.length === 1 ? '' : 'es'} · {run.acceptIds.length} accepting {layout.truncated && '· (tree truncated for display)'}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg className="mv-tree" width={W} height={H} viewBox={`-30 -20 ${W} ${H}`} role="img" aria-label="Branch tree">
            <line x1={t * COLW} x2={t * COLW} y1={-18} y2={H - 22} stroke="var(--amber)" strokeDasharray="4 4" opacity={0.6} />
            {layout.nodes.map((n) => {
              if (n.parent === null) return null;
              const x1 = (n.depth - 1) * COLW, y1 = layout.y.get(n.parent)!, x2 = n.depth * COLW, y2 = layout.y.get(n.id)!;
              const vis = n.depth <= t;
              const onPath = leafPathSet(run, sim.leafId).has(n.id);
              return (
                <g key={'e' + n.id} opacity={vis ? 1 : 0.12}>
                  <path className="e" d={`M ${x1} ${y1} C ${x1 + COLW / 2} ${y1} ${x2 - COLW / 2} ${y2} ${x2} ${y2}`}
                    stroke={onPath ? 'var(--cyan)' : 'rgba(160,170,255,0.4)'} strokeWidth={onPath ? 3 : 1.6} />
                  <text className="elbl" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5}>{n.via?.read === '' ? 'ε' : n.via?.read}</text>
                </g>
              );
            })}
            {layout.nodes.map((n) => {
              const vis = n.depth <= t;
              const leafDone = n.children.length === 0 && n.depth <= t;
              const col = n.children.length === 0 ? statusColor(n.status) : 'var(--cyan)';
              return (
                <motion.g key={n.id} className="n" initial={false} animate={{ opacity: vis ? (leafDone && n.status !== 'accept' ? 0.55 : 1) : 0.1 }}
                  onClick={n.children.length === 0 && n.status !== 'repeat' ? () => open(n.id) : undefined} style={{ cursor: n.children.length === 0 ? 'pointer' : 'default' }}>
                  <circle cx={n.depth * COLW} cy={layout.y.get(n.id)} r={14} fill="#0b0b1d" stroke={col}
                    style={leafDone && n.status === 'accept' ? { filter: 'drop-shadow(0 0 8px var(--accept))' } : undefined} />
                  <text x={n.depth * COLW} y={layout.y.get(n.id)}>{n.config.state}</text>
                  {leafDone && (
                    <text x={n.depth * COLW + 24} y={layout.y.get(n.id)} style={{ fill: col, fontSize: 12, textAnchor: 'start' }}>
                      {n.status === 'accept' ? '✓ accept' : n.status === 'stuck' ? '✗ stuck' : n.status === 'repeat' ? '↺ seen' : '✂ cut'}
                    </text>
                  )}
                  <title>{fmtID(n.config, input)}{n.reason ? ' — ' + n.reason : ''}</title>
                </motion.g>
              );
            })}
          </svg>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" onClick={() => setT(0)}>⟲</button>
          <button className="btn small" onClick={() => setT((x) => Math.max(0, x - 1))}>◀</button>
          <button className="btn small primary" onClick={() => { if (t >= layout.maxDepth) setT(0); setPlaying((p) => !p); }}>{playing ? '❚❚' : '▶ play time'}</button>
          <button className="btn small" onClick={() => setT((x) => Math.min(layout.maxDepth, x + 1))}>▶</button>
          <input type="range" min={0} max={layout.maxDepth} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} className="grow" aria-label="Scrub through time" />
          <span className="mono muted">t = {t} move{t === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-title"><b>Every branch at time t = {t}</b><span>click a branch to follow it in the Lab</span></div>
        <div className="branch-cards">
          {ls.map((leaf, i) => {
            const n = nodeAt(leaf, t);
            const ended = leaf.depth <= t;
            const cls = ended ? (leaf.status === 'accept' ? 'acc' : 'dead') : '';
            return (
              <motion.button key={leaf.id} className={`bcard ${cls} ${sim.leafId === leaf.id ? 'sel' : ''}`} onClick={() => open(leaf.id)}
                aria-label={`Branch ${i + 1}: ${branchLabel(run, leaf.id)}, ${leaf.status}`}>
                <div className="bid">branch {i + 1}{run.linear ? '' : ` · ${branchLabel(run, leaf.id)}`}</div>
                <StackTower stack={n.config.stack} bottom={machine.bottom} mini />
                <div className="bconf"><IDText c={n.config} input={input} /></div>
                <div style={{ fontSize: '0.75rem', marginTop: 4, color: ended ? statusColor(leaf.status) : 'var(--muted)' }}>
                  {ended ? (leaf.status === 'accept' ? '✓ ACCEPTS' : leaf.status === 'stuck' ? '✗ stuck — rejects' : leaf.status === 'cut' ? '✂ cut by guard' : '') : 'alive…'}
                </div>
                {ended && leaf.status !== 'accept' && <div className="dim" style={{ fontSize: '0.68rem' }}>{leaf.reason}</div>}
              </motion.button>
            );
          })}
        </div>
      </div>

      {t >= layout.maxDepth && sim.verdict && <VerdictBox v={sim.verdict} />}
      {wwrHint && (
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Slide 19: “guess after 1: q2 with stack AZ and input bba — b cannot pop A. Stuck.” Find that branch above. Then try <button className="chip" onClick={() => setInput('abab')}>abab</button>: all five guesses fail — that is what rejection by a nondeterministic machine means.
        </p>
      )}
    </div>
  );
}

const cache = new WeakMap<RunResult, Map<number, Set<number>>>();
function leafPathSet(run: RunResult, leaf: number): Set<number> {
  let m = cache.get(run);
  if (!m) { m = new Map(); cache.set(run, m); }
  if (!m.has(leaf)) m.set(leaf, new Set(pathTo(run, leaf)));
  return m.get(leaf)!;
}
