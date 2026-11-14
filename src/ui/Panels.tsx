import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { DeterminismReport } from '../engine/determinism';
import { fmtDelta, gammaKind, pushedSymbols, showSym, unread, Verdict } from '../engine/pda';
import { AcceptMode, Config, Machine, Transition } from '../engine/types';
import { traceLatex, traceText } from '../engine/trace';
import { useSettings } from './settings';

/* ------------------------------------------------------------------ */
export function Tape({ input, pos, epsMove }: { input: string; pos: number; epsMove: boolean }) {
  const { reducedMotion } = useSettings();
  const cells = [...input];
  return (
    <div className="tape-wrap">
      <div className="tape" role="img" aria-label={`Input tape. Read: ${input.slice(0, pos) || 'nothing'}. Unread: ${showSym(input.slice(pos))}.`}>
        {cells.map((ch, i) => (
          <motion.div
            key={i}
            className={`cell ${i < pos ? 'read' : ''} ${i === pos ? 'current' : ''}`}
            animate={{ opacity: i < pos ? 0.35 : 1, y: i < pos ? 6 : 0, scale: i === pos ? 1.06 : 1 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
          >
            <span className="idx">{i + 1}</span>
            {ch}
            {i === pos && <HeadMarker eps={epsMove} />}
          </motion.div>
        ))}
        <div className={`cell end ${pos >= cells.length ? 'current' : ''}`}>
          end
          {pos >= cells.length && <HeadMarker eps={epsMove} />}
        </div>
        <div style={{ marginLeft: 10, alignSelf: 'center' }}>
          <AnimatePresence>
            {epsMove && (
              <motion.span className="eps-flash" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                ε-move: the head did NOT move
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function HeadMarker({ eps }: { eps: boolean }) {
  return (
    <motion.div className="head" layoutId="tapehead" animate={eps ? { y: [0, -4, 0] } : {}} transition={{ duration: 0.4 }}>
      ▲<br />HEAD
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
export function IDText({ c, input, mark = true }: { c: Config; input: string; mark?: boolean }) {
  const s = c.stack;
  return (
    <span className="id">
      ( {c.state} , {showSym(unread(input, c.pos))} ,{' '}
      {s.length === 0 ? 'ε' : mark ? <><span className="topsym" title="top of the stack">{s[0]}</span>{s.slice(1)}</> : s} )
    </span>
  );
}

export interface Step { config: Config; via: Transition | null }

export function Trace({ steps, idx, input, onJump, footer }: { steps: Step[]; idx: number; input: string; onJump: (i: number) => void; footer?: string }) {
  const [copied, setCopied] = useState('');
  const shown = steps.slice(0, idx + 1);
  const copy = async (kind: 'text' | 'latex') => {
    const txt = kind === 'text' ? traceText(steps, input, footer) : traceLatex(steps, input, footer);
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(kind);
    setTimeout(() => setCopied(''), 1400);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-title">
        <span><b>ID trace</b> · {idx} of {steps.length - 1} moves</span>
        <span className="row" style={{ gap: 4 }}>
          <button className="btn small" onClick={() => copy('text')} title="Copy the whole trace as plain text">{copied === 'text' ? '✓ copied' : 'Copy trace'}</button>
          <button className="btn small" onClick={() => copy('latex')} title="Copy the whole trace as LaTeX (align*)">{copied === 'latex' ? '✓ copied' : 'LaTeX'}</button>
        </span>
      </div>
      <div className="trace-hint">( state , UNREAD input , stack ) — stack written <b>top first</b>: the <span className="topsym">underlined</span> symbol is the top</div>
      <div className="trace" role="list">
        {shown.map((st, i) => (
          <button
            key={i}
            role="listitem"
            className={`trace-line ${i === idx ? 'current' : ''}`}
            onClick={() => onJump(i)}
            aria-current={i === idx}
            aria-label={`Move ${i}`}
          >
            <span className="turn">{i === 0 ? '' : '⊢'}</span>
            <IDText c={st.config} input={input} />
            <span className="why">{st.via ? fmtDelta(st.via) : 'initial ID'}</span>
          </button>
        ))}
        {idx < steps.length - 1 && <div className="dim" style={{ padding: '2px 34px' }}>⊢ …</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function VerdictBox({ v, branchNote }: { v: Verdict; branchNote?: string }) {
  return (
    <motion.div
      className={`verdict ${v.accepted ? 'acc' : 'rej'}`}
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      role="status"
    >
      <div className="big">{v.headline}</div>
      <div className="grow">
        <div className="why">{v.reason}</div>
        {branchNote && <div className="notes" style={{ color: 'var(--amber)' }}>{branchNote}</div>}
        {v.notes.map((n, i) => <div key={i} className="notes">{n}</div>)}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
export function GammaCard({ t }: { t: Transition | null }) {
  const kind = t ? gammaKind(t) : null;
  const Z = t?.top ?? 'Z';
  return (
    <div>
      <div className="panel-title"><b>One operation, three choices of γ</b></div>
      <p style={{ margin: '0 0 8px', fontSize: '0.88rem' }} className="muted">
        Every move <b style={{ color: 'var(--text)' }}>replaces the top symbol {Z} by a string γ</b>. Push, pop and leave-alone are not three operations — they are three values of γ.
      </p>
      <div className="gamma-opts">
        <div className={`gamma-opt ${kind === 'pop' ? 'on' : ''}`}><div className="n">pop</div><div className="g">γ = ε</div></div>
        <div className={`gamma-opt ${kind === 'leave' ? 'on' : ''}`}><div className="n">leave alone</div><div className="g">γ = {Z}</div></div>
        <div className={`gamma-opt ${kind === 'push' ? 'on' : ''}`}><div className="n">push X</div><div className="g">γ = X{Z}</div></div>
      </div>
      <div className="formula" style={{ marginTop: 8, minHeight: '1.6em' }}>
        {t ? (
          <>
            {fmtDelta(t)} → top {t.top} replaced by γ = {showSym(t.push)}{' '}
            <span style={{ color: 'var(--magenta)' }}>
              ({kind === 'pop' ? 'pop' : kind === 'leave' ? 'leave alone' : kind === 'push' ? `push ${pushedSymbols(t)}` : 'replace'})
            </span>
          </>
        ) : (
          <span className="dim">step forward to see which γ the move uses</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ModeSwitch({ mode, onChange }: { mode: AcceptMode; onChange: (m: AcceptMode) => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="Acceptance mode">
      <button aria-pressed={mode === 'final'} onClick={() => onChange('final')}>Final state · L(M)</button>
      <button aria-pressed={mode === 'empty'} onClick={() => onChange('empty')}>Empty stack · N(M)</button>
    </div>
  );
}

export function AcceptPanel({ machine, mode, onChange, both }: {
  machine: Machine; mode: AcceptMode; onChange: (m: AcceptMode) => void; both: { final: boolean; empty: boolean };
}) {
  return (
    <div>
      <div className="panel-title"><b>Acceptance mode</b><span>you choose — say which!</span></div>
      <ModeSwitch mode={mode} onChange={onChange} />
      <div className="judge">
        <div className={mode === 'final' ? 'sel' : ''}>
          <div className="formula">L(M) = {'{'} w : (q₀, w, Z₀) ⊢* (p, ε, γ), p ∈ F {'}'}</div>
          <div className="muted" style={{ fontSize: '0.78rem' }}>input consumed and state ∈ F = {'{'}{machine.finals.join(', ') || ' '}{'}'}{machine.finals.length ? '' : ' = ∅'}; stack ignored</div>
          <div style={{ marginTop: 4 }}>this input: <b className={both.final ? 'ok' : 'err'}>{both.final ? 'accept' : 'reject'}</b></div>
        </div>
        <div className={mode === 'empty' ? 'sel' : ''}>
          <div className="formula">N(M) = {'{'} w : (q₀, w, Z₀) ⊢* (p, ε, ε) {'}'}</div>
          <div className="muted" style={{ fontSize: '0.78rem' }}>input consumed and stack completely empty, {machine.bottom} included; state ignored</div>
          <div style={{ marginTop: 4 }}>this input: <b className={both.empty ? 'ok' : 'err'}>{both.empty ? 'accept' : 'reject'}</b></div>
        </div>
      </div>
      {mode !== machine.mode && (
        <div className="warn" style={{ fontSize: '0.8rem', marginTop: 6 }}>
          ⚠ {machine.name} was designed for {machine.mode === 'final' ? 'final-state' : 'empty-stack'} acceptance. Under the other mode it recognises a different language
          {mode === 'final' && machine.finals.length === 0 ? ' (F = ∅, so nothing at all).' : '.'}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function Inspector({ report, onClose }: { report: DeterminismReport; onClose?: () => void }) {
  return (
    <div className="inspector">
      <div className="panel-title"><b>Determinism inspector</b>{onClose && <button className="btn small" onClick={onClose}>close</button>}</div>
      <div className="formula" style={{ fontSize: '0.8rem' }}>
        Rule 1: |δ(q, a, Z)| ≤ 1 for every q, Z, a ∈ Σ ∪ {'{'}ε{'}'} <b className={report.rule1 ? 'ok' : 'err'}>{report.rule1 ? '✓' : '✗'}</b><br />
        Rule 2: δ(q, ε, Z) ≠ ∅ ⇒ δ(q, a, Z) = ∅ for all a ∈ Σ <b className={report.rule2 ? 'ok' : 'err'}>{report.rule2 ? '✓' : '✗'}</b>
      </div>
      <p style={{ margin: '8px 0', fontWeight: 600 }} className={report.deterministic ? 'ok' : 'err'}>{report.summary}</p>
      {report.violations.slice(0, 6).map((v, i) => (
        <div key={i} className="v">
          <div>{v.message}</div>
          <div className="mono muted" style={{ fontSize: '0.78rem' }}>{v.transitions.map(fmtDelta).join('   ·   ')}</div>
        </div>
      ))}
      {report.violations.length > 6 && <div className="muted">…and {report.violations.length - 6} more (all highlighted red on the diagram).</div>}
      {!report.deterministic && <div className="muted" style={{ fontSize: '0.8rem' }}>Offending transitions are drawn red on the diagram.</div>}
    </div>
  );
}
