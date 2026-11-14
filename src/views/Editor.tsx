import { useMemo, useState } from 'react';
import { checkDeterminism } from '../engine/determinism';
import { encodeForUrl, parseMachine, serializeMachine } from '../engine/parse';
import { PRESETS } from '../engine/presets';
import { Machine } from '../engine/types';
import { Diagram } from '../ui/Diagram';
import { Inspector } from '../ui/Panels';

const TEMPLATE = `# A PDA, one item per line.  '#' starts a comment.
name: my aⁿbⁿ
language: { aⁿbⁿ : n ≥ 1 }
Q: q0 q1 q2
Sigma: a b
Gamma: X Z
start: q0
bottom: Z
F: q2
mode: final          # or: empty

# state, read, top -> new state, γ   (eps = ε, γ written TOP FIRST)
q0, a, Z -> q0, XZ
q0, a, X -> q0, XX
q0, b, X -> q1, eps
q1, b, X -> q1, eps
q1, eps, Z -> q2, Z
`;

export function Editor({ current, onUse }: { current: Machine; onUse: (m: Machine, text: string) => void }) {
  const [text, setText] = useState(() => (current.id === 'custom' || PRESETS.some((p) => p.id === current.id) ? serializeMachine(current) : TEMPLATE));
  const [copied, setCopied] = useState(false);
  const res = useMemo(() => parseMachine(text), [text]);
  const report = useMemo(() => (res.machine ? checkDeterminism(res.machine) : null), [res.machine]);
  const bad = useMemo(() => (report ? new Set(report.violations.flatMap((v) => v.transitions.map((t) => t.id))) : undefined), [report]);

  const share = async () => {
    const url = `${location.origin}${location.pathname}#view=lab&m=${encodeForUrl(text)}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    history.replaceState(null, '', url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Machine editor</h1>
          <p>Define Q, Σ, Γ, q₀, Z₀, F and δ in plain text. Each transition is one line: <span className="mono">q0, a, Z -&gt; q0, XZ</span>. Use <span className="mono">eps</span> (or ε) for the empty string, <span className="mono">|</span> for several targets, or write <span className="mono">δ(q0, a, Z) = (q0, XZ)</span>.</p>
        </div>
        <div className="row">
          <span className="muted" style={{ fontSize: '0.85rem' }}>start from:</span>
          {PRESETS.map((p) => <button key={p.id} className="chip" onClick={() => setText(serializeMachine(p))}>{p.short}</button>)}
          <button className="chip" onClick={() => setText(TEMPLATE)}>template</button>
        </div>
      </div>
      <div className="editor-grid">
        <section className="panel">
          <label className="panel-title" htmlFor="ed"><b>Definition</b><span>{text.split('\n').length} lines</span></label>
          <textarea id="ed" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={!res.machine} onClick={() => res.machine && onUse(res.machine, text)}>Run it in the Lab</button>
            <button className="btn" disabled={!res.machine} onClick={share}>{copied ? '✓ link copied' : 'Copy share link'}</button>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><b>Check</b><span>{res.errors.length ? `${res.errors.length} error(s)` : 'valid ✓'}</span></div>
          <div className="issues">
            {res.errors.map((e, i) => <div key={'e' + i} className="err">✗ {e.message}</div>)}
            {res.warnings.map((w, i) => <div key={'w' + i} className="warn">⚠ {w.message}</div>)}
            {!res.errors.length && !res.warnings.length && <div className="ok">✓ No problems found.</div>}
          </div>
          {res.machine && (
            <>
              <div className="diagram-box" style={{ marginTop: 8 }}><Diagram machine={res.machine} bad={bad} /></div>
              {report && <Inspector report={report} />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
