import { showSym } from '../engine/pda';
import { SLIDE_EXAMPLES, SlideExample } from '../engine/slideExamples';

const where = (e: SlideExample) =>
  e.view === 'multiverse' ? 'Multiverse' : e.view === 'compare' ? 'Comparison' : e.view === 'mistakes' ? 'Mistakes page' : 'Lab';

export function Examples({ open }: { open: (i: number) => void }) {
  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Slide examples <span className="muted" style={{ fontSize: '1rem' }}>— Session 20, in deck order</span></h1>
          <p>Every worked example from the slides, ready to run. Click one to load the machine, the string and the acceptance mode, stopped at the moment the slide talks about. Use Prev / Next in the bar at the top to go through them in order.</p>
        </div>
        <button className="btn primary" onClick={() => open(0)}>Start from the first example</button>
      </div>
      <ol className="ex-list">
        {SLIDE_EXAMPLES.map((e, i) => (
          <li key={e.id}>
            <button className="ex-card" onClick={() => open(i)}>
              <span className="ex-num">{i + 1}</span>
              <span className="ex-body">
                <span className="ex-slide">{e.slide}</span>
                <span className="ex-title">{e.title}</span>
                <span className="ex-look">{e.look}</span>
                <span className="ex-meta">
                  {e.machine && <span className="mono">{e.machine.name}</span>}
                  {e.input !== undefined && <span className="mono">w = {showSym(e.input)}</span>}
                  {e.mode && <span>{e.mode === 'final' ? 'final state' : 'empty stack'}</span>}
                  <span>opens in: {where(e)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ExampleBar({ index, open, close }: { index: number; open: (i: number) => void; close: () => void }) {
  const e = SLIDE_EXAMPLES[index];
  const n = SLIDE_EXAMPLES.length;
  return (
    <div className="ex-bar" role="region" aria-label="Current slide example">
      <div className="ex-bar-text">
        <span className="ex-slide">{e.slide} · example {index + 1} of {n}</span>
        <b>{e.title}</b>
        <span className="ex-look">{e.look}</span>
      </div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button className="btn small" onClick={() => open(index)} title="Load this example again from the start">Replay</button>
        <button className="btn small" disabled={index === 0} onClick={() => open(index - 1)}>‹ Prev</button>
        <button className="btn small primary" disabled={index === n - 1} onClick={() => open(index + 1)}>Next ›</button>
        <button className="btn small" onClick={close} aria-label="Close example bar">✕</button>
      </div>
    </div>
  );
}
