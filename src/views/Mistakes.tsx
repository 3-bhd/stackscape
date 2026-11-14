import { useState } from 'react';
import { ANBN, T } from '../engine/presets';
import { Machine } from '../engine/types';
import { MiniRun } from '../ui/MiniRun';

export const NO_MARKER: Machine = {
  id: 'nomarker', name: 'counter with no marker', language: '', mode: 'empty',
  states: ['q0', 'q1'], inputAlphabet: ['a', 'b'], stackAlphabet: ['X'], start: 'q0', bottom: 'X', finals: [],
  transitions: T(['q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps']),
};

export const BACKWARDS: Machine = {
  ...ANBN, id: 'backwards', name: 'aⁿbⁿ, stack written backwards',
  transitions: T(['q0, a, Z -> q0, ZX', 'q0, a, X -> q0, XX', 'q0, b, X -> q1, eps', 'q1, b, X -> q1, eps', 'q1, eps, Z -> q2, Z']),
};

function Toggle({ a, b, value, onChange }: { a: string; b: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mode-switch" role="group">
      <button aria-pressed={!value} onClick={() => onChange(false)}>{a}</button>
      <button aria-pressed={value} onClick={() => onChange(true)}>{b}</button>
    </div>
  );
}

export function Mistakes() {
  const [m1, setM1] = useState(false);
  const [w1, setW1] = useState('aabb');
  const [m2, setM2] = useState(false);
  const [w3, setW3] = useState('abab');
  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Three ways a PDA answer goes wrong</h1>
          <p>From slide 16. Each card has a live demo: run the broken version, then the correct one.</p>
        </div>
      </div>
      <div className="cards3">
        <section className="panel">
          <div className="panel-title"><b>1 · Forgetting the bottom marker</b></div>
          <p style={{ fontSize: '0.9rem' }}>Without Z₀ the machine cannot tell “nothing left to match” from “nothing I am allowed to see”. Every counting machine needs it — the marker is what makes the acceptance test expressible.</p>
          <div className="wrongright">
            <div className="wr-bad">✗ Γ = {'{'} X {'}'}<br />δ(q1, ε, ?) = accept<br /><span className="dim">— there is no ? to test</span></div>
            <div className="wr-good">✓ Γ = {'{'} X, Z {'}'}<br />δ(q1, ε, Z) = (q2, Z)</div>
          </div>
          <div className="row" style={{ margin: '10px 0' }}>
            <Toggle a="✗ no marker" b="✓ with Z" value={m1} onChange={setM1} />
            {['aabb', 'aabbb'].map((w) => <button key={w} className="chip" aria-pressed={w1 === w} onClick={() => setW1(w)}>{w}</button>)}
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            {m1 ? 'With Z, the last ε-move fires exactly when the count is back to zero.' : 'Here the start symbol is just another X, so it gets counted: aabb leaves one X behind (reject) and aabbb is accepted. Off by one — the machine accepts aⁿbⁿ⁺¹.'}
          </p>
          <MiniRun key={`${m1}${w1}`} machine={m1 ? ANBN : NO_MARKER} input={w1} mode={m1 ? 'final' : 'empty'} />
        </section>

        <section className="panel">
          <div className="panel-title"><b>2 · Writing the stack the wrong way round</b></div>
          <p style={{ fontSize: '0.9rem' }}>This course writes the stack <b>top first</b>: δ(q, a, Z) = {'{'}(p, XZ){'}'} pushes X above Z. ZX means the opposite, and every later step breaks while still looking plausible.</p>
          <div className="wrongright">
            <div className="wr-good">✓ Z → X Z<br />( q , bb , X X Z )<br /><span className="warn">  ↑ top</span></div>
            <div className="wr-bad">✗ Z → Z X<br /><span className="dim">Z is back on top — the next move sees Z, not X</span></div>
          </div>
          <div className="row" style={{ margin: '10px 0' }}>
            <Toggle a="✗ γ = ZX" b="✓ γ = XZ" value={m2} onChange={setM2} />
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>Check by asking which symbol the next transition looks at: it must be the one you just pushed.</p>
          <MiniRun key={String(m2)} machine={m2 ? ANBN : BACKWARDS} input="aabb" mode="final" />
        </section>

        <section className="panel">
          <div className="panel-title"><b>3 · Treating “stuck” as an error</b></div>
          <p style={{ fontSize: '0.9rem' }}>A PDA with no applicable transition halts and that branch <b>rejects</b>. It is not a malformed machine and does not need a dead state. Unlike a DFA, a PDA is not required to be total — missing transitions are how it rejects.</p>
          <div className="code">(q0,abab,Z) ⊢ (q0,bab,XZ) ⊢ (q1,ab,Z) ⊢ (q2,ab,Z){'\n'}no move on a from q2 ⇒ REJECT, correctly</div>
          <div className="row" style={{ margin: '10px 0' }}>
            {['abab', 'aab', 'aabb'].map((w) => <button key={w} className="chip" aria-pressed={w3 === w} onClick={() => setW3(w)}>{w}</button>)}
          </div>
          <MiniRun key={w3} machine={ANBN} input={w3} mode="final" diagram />
        </section>
      </div>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>
        Note on slide 16’s abab trace: it stops at (q1, ab, Z), but δ(q1, ε, Z) = (q2, Z) still applies there, so the machine first takes that ε-move and gets stuck in q2 with a unread. The verdict is the same: reject.
      </p>
    </div>
  );
}
