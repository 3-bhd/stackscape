import { useEffect, useMemo, useRef, useState } from 'react';
import { checkDeterminism } from '../engine/determinism';
import { narrate } from '../engine/narrate';
import { gammaKind, leaves } from '../engine/pda';
import { Preset, PRESETS } from '../engine/presets';
import { AcceptMode, Machine } from '../engine/types';
import { Diagram } from '../ui/Diagram';
import { AcceptPanel, GammaCard, Inspector, Tape, Trace, VerdictBox } from '../ui/Panels';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';
import { StackTower } from '../ui/StackTower';
import { Sim } from '../ui/useSim';

interface Props {
  machine: Machine;
  input: string;
  mode: AcceptMode;
  sim: Sim;
  setInput: (s: string) => void;
  setMode: (m: AcceptMode) => void;
  pickPreset: (p: Preset) => void;
  goto: (view: string) => void;
  spotlight?: string | null;
  tourActive?: boolean;
  initialStep?: number;
}

export function Lab({ machine, input, mode, sim, setInput, setMode, pickPreset, goto, spotlight, tourActive, initialStep }: Props) {
  const usedInitial = useRef(false);
  const { present } = useSettings();
  const { run, steps, pb, problem } = sim;
  const [showInspector, setShowInspector] = useState(false);
  const [draft, setDraft] = useState(input);
  useEffect(() => setDraft(input), [input]);
  const report = useMemo(() => checkDeterminism(machine), [machine]);
  const bad = useMemo(() => (showInspector ? new Set(report.violations.flatMap((v) => v.transitions.map((t) => t.id))) : undefined), [showInspector, report]);
  const preset = PRESETS.find((p) => p.id === machine.id);

  const cur = steps[Math.min(pb.idx, steps.length - 1)];
  const via = cur.via;
  const epsMove = !!via && via.read === '';

  useEffect(() => {
    if (!usedInitial.current && initialStep) { usedInitial.current = true; const h = setTimeout(() => sim.pb.setIdx(initialStep), 50); return () => clearTimeout(h); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); pb.setPlaying(false); pb.forward(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pb.back(); }
      else if (e.key === ' ') { if (tag === 'BUTTON') return; e.preventDefault(); pb.toggle(); }
      else if (e.key === 'r' || e.key === 'R') pb.reset();
      else if (e.key === 'End' || e.key === 'e' || e.key === 'E') pb.end();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pb]);

  /* sound effects */
  const lastIdx = useRef(pb.idx);
  useEffect(() => {
    if (pb.idx > lastIdx.current && via) {
      const k = gammaKind(via);
      if (k === 'pop') sfx.pop(); else if (k === 'push') sfx.push(); else if (k === 'replace') sfx.swap(); else sfx.eps();
      if (pb.atEnd && sim.verdict) setTimeout(() => (sim.verdict!.accepted && sim.leafNode?.status === 'accept' ? sfx.accept() : sfx.stuck()), 250);
    }
    lastIdx.current = pb.idx;
  }, [pb.idx, via, pb.atEnd, sim.verdict, sim.leafNode]);

  const ls = run ? leaves(run).filter((n) => n.status !== 'repeat') : [];
  const branchIdx = ls.findIndex((n) => n.id === sim.leafId);
  const branchNote = run && pb.atEnd && sim.leafNode && sim.leafNode.status !== 'accept'
    ? (run.accepted ? `This branch rejects (${sim.leafNode.reason}) — but another branch accepts, and one is enough.` : undefined)
    : undefined;
  const sp = (k: string) => (spotlight === k ? 'spotlight' : '');

  return (
    <div>
      <div className="machinebar">
        <div className="presets" role="group" aria-label="Preset machines">
          {PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={machine.id === p.id} onClick={() => pickPreset(p)} disabled={tourActive}>
              {p.short} <span className={`tag ${p.deterministic ? 'det' : 'nd'}`} style={{ marginLeft: 4 }}>{p.deterministic ? 'DPDA' : 'NPDA'}</span>
            </button>
          ))}
          {machine.id === 'custom' && <button className="chip" aria-pressed>{machine.name}</button>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <span className="muted hide-present" style={{ fontSize: '0.8rem' }}>accept by</span>
          <div className="mode-switch" role="group" aria-label="Acceptance mode">
            <button aria-pressed={mode === 'final'} onClick={() => setMode('final')}>final state</button>
            <button aria-pressed={mode === 'empty'} onClick={() => setMode('empty')}>empty stack</button>
          </div>
        </div>
        <form className="inputrow" onSubmit={(e) => { e.preventDefault(); setInput(draft.replace(/\s+/g, '').replace(/ε/g, '')); }}>
          <label htmlFor="inp" className="muted" style={{ fontSize: '0.85rem' }}>input w =</label>
          <input id="inp" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ε" spellCheck={false} autoComplete="off" disabled={tourActive} />
          <button className="btn primary small" type="submit" disabled={tourActive}>Run</button>
          {preset?.demos.map((d) => (
            <button type="button" key={d.input} className="chip hide-present" aria-pressed={input === d.input} onClick={() => setInput(d.input)} disabled={tourActive}>
              {d.input}<span className="note">{d.note}</span>
            </button>
          ))}
        </form>
      </div>
      {problem && <div className="panel err" style={{ marginBottom: 12 }}>Can’t run this input: {problem}.</div>}

      <div className="lab-grid">
        <section className={`panel area-tape ${sp('tape')}`} aria-label="Input tape">
          <div className="panel-title"><b>Input tape</b><span>read: <span className="mono">{input.slice(0, cur.config.pos) || 'ε'}</span> · unread w = <span className="mono" style={{ color: 'var(--text)' }}>{input.slice(cur.config.pos) || 'ε'}</span></span></div>
          <Tape input={input} pos={cur.config.pos} epsMove={epsMove} />
        </section>

        <section className={`panel area-ctrl ${sp('ctrl')}`} aria-label="Finite control" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <b>Control · {machine.name}</b>
            <span className="row" style={{ gap: 6 }}>
              <span className={`tag ${report.deterministic ? 'det' : 'nd'}`}>{report.deterministic ? 'deterministic' : 'nondeterministic'}</span>
              <button className="btn small hide-present" aria-pressed={showInspector} onClick={() => setShowInspector((s) => !s)}>
                {showInspector ? 'hide check' : 'Check determinism'}
              </button>
            </span>
          </div>
          <div className="diagram-box">
            <Diagram machine={machine} active={cur.config.state} fired={via?.id ?? null} bad={bad} />
          </div>
          <div className="mono" style={{ fontSize: '0.85rem', minHeight: '1.4em', color: via ? 'var(--magenta)' : 'var(--dim)' }}>
            {via ? `fired: ${via.read === '' ? 'ε' : via.read}, ${via.top} → ${via.push || 'ε'}   (${via.from} → ${via.to})` : `in ${cur.config.state}, nothing fired yet`}
          </div>
          {showInspector && <div style={{ marginTop: 8 }}><Inspector report={report} /></div>}
        </section>

        <section className={`panel area-stack ${sp('stack')}`} aria-label="Stack" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title"><b>Stack</b><span>drawn with the top at the top</span></div>
          <div style={{ flex: 1 }}>
            <StackTower stack={cur.config.stack} bottom={machine.bottom} />
          </div>
        </section>

        <section className={`panel area-trace ${sp('trace')}`} aria-label="ID trace">
          <Trace steps={steps} idx={pb.idx} input={input} onJump={(i) => { pb.setPlaying(false); pb.setIdx(i); }}
            footer={sim.verdict ? `${sim.verdict.headline}: ${sim.verdict.reason}` : undefined} />
        </section>

        <section className={`panel area-play ${sp('play')}`} aria-label="Playback">
          <div className="playbar">
            <button className="btn" onClick={pb.reset} title="Reset (R)" aria-label="Reset">⟲</button>
            <button className="btn" onClick={pb.back} disabled={pb.idx === 0} title="Step back (←)" aria-label="Step back">◀</button>
            <button className="btn primary" onClick={pb.toggle} title="Play / pause (space)" aria-label={pb.playing ? 'Pause' : 'Play'} style={{ minWidth: 70 }}>
              {pb.playing ? 'Pause' : 'Play'}
            </button>
            <button className="btn" onClick={() => { pb.setPlaying(false); pb.forward(); }} disabled={pb.atEnd} title="Step forward (→)" aria-label="Step forward">▶</button>
            <button className="btn" onClick={pb.end} title="Jump to end (E / End)" aria-label="Jump to end">⏭</button>
            <label className="speed hide-present">
              speed
              <input type="range" min={0.5} max={6} step={0.5} value={pb.speed} onChange={(e) => pb.setSpeed(+e.target.value)} aria-label="Playback speed" />
              <span className="mono">{pb.speed}×/s</span>
            </label>
            <div className="narration" aria-live="polite">
              <span className="stepno">{pb.idx}/{steps.length - 1}</span>
              {narrate(machine, via, cur.config, input)}
            </div>
            {run && !run.linear && (
              <div className="row hide-present" style={{ gap: 4 }}>
                <span className="muted" style={{ fontSize: '0.8rem' }}>branch {branchIdx + 1}/{ls.length}</span>
                <button className="btn small" onClick={() => sim.selectLeaf(ls[(branchIdx - 1 + ls.length) % ls.length].id)} aria-label="Previous branch">‹</button>
                <button className="btn small" onClick={() => sim.selectLeaf(ls[(branchIdx + 1) % ls.length].id)} aria-label="Next branch">›</button>
                <button className="btn small pink" onClick={() => goto('multiverse')}>Show all branches</button>
              </div>
            )}
          </div>
          {pb.atEnd && sim.verdict && <div style={{ marginTop: 10 }}><VerdictBox v={sim.verdict} branchNote={branchNote} /></div>}
          {!pb.atEnd && <div className="dim hide-present" style={{ fontSize: '0.75rem', marginTop: 6 }}>Keys: <kbd>→</kbd> step · <kbd>←</kbd> back · <kbd>space</kbd> play · <kbd>R</kbd> reset · <kbd>E</kbd> end · <kbd>P</kbd> presentation</div>}
        </section>

      </div>
      {!present && (
          <div className="lab-bottom">
            <section className="panel"><GammaCard t={via} /></section>
            <section className="panel"><AcceptPanel machine={machine} mode={mode} onChange={setMode} both={sim.both} /></section>
            <section className="panel">
              <div className="panel-title"><b>The machine</b><span>{preset?.source ?? 'custom'}</span></div>
              <div className="formula" style={{ fontSize: '0.8rem' }}>
                M = ( {'{'}{machine.states.join(', ')}{'}'}, {'{'}{machine.inputAlphabet.join(', ')}{'}'}, {'{'}{machine.stackAlphabet.join(', ')}{'}'}, δ, {machine.start}, {machine.bottom}, {machine.finals.length ? `{${machine.finals.join(', ')}}` : '∅'} )
              </div>
              {machine.language && <div style={{ margin: '4px 0' }}>Language: <span className="mono">{machine.language}</span></div>}
              {preset && <p style={{ fontSize: '0.88rem', margin: '6px 0' }}>{preset.stackMeaning}</p>}
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn small" onClick={() => goto('editor')}>Edit / copy this machine</button>
                {!report.deterministic && <button className="btn small pink" onClick={() => goto('multiverse')}>See every branch</button>}
              </div>
            </section>
          </div>
      )}
    </div>
  );
}
