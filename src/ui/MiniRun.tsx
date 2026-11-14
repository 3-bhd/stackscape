import { useMemo } from 'react';
import { fmtDelta, leaves } from '../engine/pda';
import { AcceptMode, Machine } from '../engine/types';
import { Diagram } from './Diagram';
import { IDText, VerdictBox } from './Panels';
import { StackTower } from './StackTower';
import { useSim } from './useSim';

interface Props {
  machine: Machine;
  input: string;
  mode?: AcceptMode;
  diagram?: boolean;
  bad?: Set<string>;
  marked?: Set<string>;
  /** external step control (for side-by-side syncing) */
  extIdx?: number;
}

/** A compact, self-contained run: mini stack + current ID + trace + verdict. */
export function MiniRun({ machine, input, mode = machine.mode, diagram, bad, marked, extIdx }: Props) {
  const sim = useSim(machine, input, mode);
  const { pb, steps } = sim;
  const idx = extIdx !== undefined ? Math.min(extIdx, steps.length - 1) : pb.idx;
  const cur = steps[idx];
  const atEnd = idx >= steps.length - 1;
  const branches = useMemo(() => (sim.run ? leaves(sim.run).filter((n) => n.status !== 'repeat').length : 0), [sim.run]);

  if (sim.problem) return <div className="err">Input problem: {sim.problem}</div>;
  return (
    <div>
      {diagram && (
        <div style={{ height: 250, display: 'flex' }}>
          <Diagram machine={machine} active={cur.config.state} fired={cur.via?.id ?? null} bad={bad} marked={marked} compact />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, alignItems: 'end' }}>
        <StackTower stack={cur.config.stack} bottom={machine.bottom} mini />
        <div className="trace" style={{ maxHeight: 170, fontSize: '0.8rem' }}>
          {steps.slice(0, idx + 1).map((s, i) => (
            <div key={i} className={`trace-line ${i === idx ? 'current' : ''}`} style={{ cursor: 'default', gridTemplateColumns: '14px auto' }}>
              <span className="turn">{i ? '⊢' : ''}</span>
              <span>
                <IDText c={s.config} input={input} />
                {s.via && <span className="why" style={{ display: 'block' }}>{fmtDelta(s.via)}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      {extIdx === undefined && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn small" onClick={pb.reset} aria-label="Reset">⟲</button>
          <button className="btn small" onClick={pb.back} disabled={pb.idx === 0} aria-label="Back">◀</button>
          <button className="btn small primary" onClick={pb.toggle}>{pb.playing ? '❚❚' : '▶'}</button>
          <button className="btn small" onClick={() => { pb.setPlaying(false); pb.forward(); }} disabled={atEnd} aria-label="Forward">▶</button>
          <button className="btn small" onClick={pb.end} aria-label="End">⏭</button>
          <span className="muted mono" style={{ fontSize: '0.8rem' }}>{idx}/{steps.length - 1}{branches > 1 ? ` · ${branches} branches` : ''}</span>
        </div>
      )}
      {atEnd && sim.verdict && <div style={{ marginTop: 8 }}><VerdictBox v={sim.verdict} /></div>}
    </div>
  );
}
