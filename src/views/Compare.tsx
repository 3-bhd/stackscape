import { useEffect, useMemo, useState } from 'react';
import { explore, leaves } from '../engine/pda';
import { checkDeterminism } from '../engine/determinism';
import { WCWR, WWR } from '../engine/presets';
import { MiniRun } from '../ui/MiniRun';

const rev = (s: string) => [...s].reverse().join('');

const LEFT = [
  ['push', 'a, X → AX'], ['', 'b, X → BX'], ['switch', 'c, X → X'], ['match', 'a, A → ε'], ['', 'b, B → ε'], ['accept', 'ε, Z → Z'],
];
const RIGHT = [
  ['push', 'a, X → AX'], ['', 'b, X → BX'], ['switch', 'ε, X → X   ← GUESS'], ['match', 'a, A → ε'], ['', 'b, B → ε'], ['accept', 'ε, Z → ε'],
];

export function Compare() {
  const [w, setW] = useState('ab');
  const [draft, setDraft] = useState('ab');
  const [broken, setBroken] = useState(false);
  const left = w + 'c' + (broken ? w : rev(w));
  const right = w + (broken ? w : rev(w));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const maxT = useMemo(() => {
    const a = explore(WCWR, left, 'final'), b = explore(WWR, right, 'empty');
    return Math.max(...leaves(a).map((n) => n.depth), ...leaves(b).map((n) => n.depth));
  }, [left, right]);
  useEffect(() => { setT(0); setPlaying(false); }, [left, right]);
  useEffect(() => {
    if (!playing) return;
    if (t >= maxT) { setPlaying(false); return; }
    const h = setTimeout(() => setT((x) => x + 1), 800);
    return () => clearTimeout(h);
  }, [playing, t, maxT]);
  const dl = useMemo(() => checkDeterminism(WCWR), []);
  const dr = useMemo(() => checkDeterminism(WWR), []);
  const badR = useMemo(() => new Set(dr.violations.flatMap((v) => v.transitions.filter((t) => t.read === '' && t.from === 'q1').map((t) => t.id))), [dr]);
  const markL = useMemo(() => new Set(WCWR.transitions.filter((t) => t.read === 'c').map((t) => t.id)), []);

  return (
    <div>
      <div className="banner">
        DFA <span className="eq">=</span> NFA &nbsp;·&nbsp; but &nbsp;DPDA <span className="ne">⊊</span> PDA
      </div>
      <div className="view-head">
        <div>
          <h1>Remove one symbol, lose determinism</h1>
          <p>Slide 13: the same machine twice. With the marker c in the input the machine <i>sees</i> the middle arrive. Delete the c and the switch c, X → X becomes ε, X → X — a guess. (X stands for any stack symbol A, B or Z.)</p>
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setW(draft.replace(/[^ab]/g, '').slice(0, 6)); }}>
          <label className="muted">w =</label>
          <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ width: 100, fontFamily: 'var(--mono)' }} aria-label="w over a, b" />
          <button className="btn primary small">Go</button>
          <button type="button" className="chip" aria-pressed={broken} onClick={() => setBroken((b) => !b)}>{broken ? 'second half = w (not a mirror)' : 'second half = wᴿ'}</button>
        </form>
      </div>
      <div className="panel row" style={{ marginBottom: 12 }}>
        <b>Step both machines together:</b>
        <button className="btn small" onClick={() => { setPlaying(false); setT(0); }} aria-label="Reset both">⟲</button>
        <button className="btn small" onClick={() => { setPlaying(false); setT(Math.max(0, t - 1)); }} aria-label="Back">◀</button>
        <button className="btn small primary" onClick={() => { if (t >= maxT) setT(0); setPlaying((p) => !p); }}>{playing ? 'Pause' : 'Play both'}</button>
        <button className="btn small" onClick={() => { setPlaying(false); setT(Math.min(maxT, t + 1)); }} aria-label="Forward">▶</button>
        <button className="btn small" onClick={() => { setPlaying(false); setT(maxT); }} aria-label="End">⏭</button>
        <span className="mono muted">move {t}</span>
        <span className="muted" style={{ fontSize: '0.85rem' }}>— left: the c is <i>read</i>, so the switch happens on a real symbol. Right: the machine follows its accepting branch (the right guess); the other guesses are in the Multiverse.</span>
      </div>
      <div className="two">
        <section className="panel">
          <div className="panel-title"><b>w c wᴿ — deterministic</b><span className="tag det">DPDA</span></div>
          <div className="delta-list">
            {LEFT.map(([k, r], i) => <div key={i} className={`delta-item ${k === 'switch' ? 'good' : ''}`}><span className="dim" style={{ display: 'inline-block', width: 64 }}>{k}</span>{r}</div>)}
          </div>
          <p className="ok" style={{ fontSize: '0.86rem' }}>{dl.summary}</p>
          <div className="muted" style={{ marginBottom: 6 }}>input: <span className="mono">{left}</span> · accept by final state</div>
          <MiniRun key={left} machine={WCWR} input={left} mode="final" diagram marked={markL} extIdx={t} />
        </section>
        <section className="panel">
          <div className="panel-title"><b>w wᴿ — nondeterministic</b><span className="tag nd">NPDA</span></div>
          <div className="delta-list">
            {RIGHT.map(([k, r], i) => <div key={i} className={`delta-item ${k === 'switch' ? 'changed' : ''}`}><span className="dim" style={{ display: 'inline-block', width: 64 }}>{k}</span>{r}</div>)}
          </div>
          <p className="err" style={{ fontSize: '0.86rem' }}>{dr.summary} The ε-switch at (q1, X) collides with the push moves there.</p>
          <div className="muted" style={{ marginBottom: 6 }}>input: <span className="mono">{right || 'ε'}</span> · accept by empty stack · {right.length + 1} possible guesses</div>
          <MiniRun key={right} machine={WWR} input={right} mode="empty" diagram bad={badR} extIdx={t} />
        </section>
      </div>
      <p className="muted" style={{ marginTop: 12, maxWidth: '80ch' }}>
        For finite automata the subset construction turns every NFA into a DFA, so nondeterminism is only a convenience. For pushdown automata there is no such construction: {'{'} wwᴿ {'}'} is accepted by a PDA and by <b>no</b> DPDA. A deterministic machine gets one attempt; the nondeterministic one tries every midpoint at once.
      </p>
      <p className="dim" style={{ fontSize: '0.8rem' }}>
        Slide 13 writes the wwᴿ accept rule as ε, Z → Z; slides 18–19 (used here) write ε, Z → ε with empty-stack acceptance.
      </p>
    </div>
  );
}
