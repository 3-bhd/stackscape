import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { allStrings, LANGUAGES } from '../engine/languages';
import { explore, fmtDelta, fmtID, pathTo, primaryLeaf, showSym, verdict } from '../engine/pda';
import { ANB2N, ANBN, Preset, PRESETS, WCWR } from '../engine/presets';
import { BUGS } from '../engine/bugs';
import { Config, Machine, Transition } from '../engine/types';
import { Diagram } from '../ui/Diagram';
import { IDText } from '../ui/Panels';
import { load, save } from '../ui/settings';
import { sfx } from '../ui/sound';
import { StackTower } from '../ui/StackTower';
import { MiniRun } from '../ui/MiniRun';

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const shuffle = <T,>(xs: T[]): T[] => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const normID = (s: string) => s.replace(/\s+/g, '').replace(/eps|λ|Λ/gi, 'ε').replace(/[()]/g, '').toLowerCase();

interface Score { score: number; streak: number; best: number }

function useScore() {
  const [s, setS] = useState<Score>(() => load('score', { score: 0, streak: 0, best: 0 }));
  const hit = useCallback((ok: boolean, pts = 10) => {
    setS((p) => {
      const streak = ok ? p.streak + 1 : 0;
      const n = { score: p.score + (ok ? pts + Math.min(p.streak, 5) * 2 : 0), streak, best: Math.max(p.best, streak) };
      save('score', n);
      return n;
    });
    if (ok) sfx.accept(); else sfx.stuck();
  }, []);
  const reset = () => { const n = { score: 0, streak: 0, best: 0 }; save('score', n); setS(n); };
  return { s, hit, reset };
}

export function Challenge({ openInLab }: { openInLab: (machineId: string, input: string) => void }) {
  const [tab, setTab] = useState<'predict' | 'accept' | 'bug'>('predict');
  const { s, hit, reset } = useScore();
  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Challenge mode 🎮</h1>
          <p>Three games. Streaks multiply your points. Your score is kept in this browser.</p>
        </div>
        <div className="row">
          <div className="score" aria-live="polite">
            <span>score <b>{s.score}</b></span>
            <span className="streak">streak <b>{s.streak}🔥</b></span>
            <span>best <b>{s.best}</b></span>
          </div>
          <button className="btn small" onClick={reset}>reset</button>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }} role="tablist">
        <button role="tab" className="chip" aria-pressed={tab === 'predict'} aria-selected={tab === 'predict'} onClick={() => setTab('predict')}>(a) Predict the next ID</button>
        <button role="tab" className="chip" aria-pressed={tab === 'accept'} aria-selected={tab === 'accept'} onClick={() => setTab('accept')}>(b) Will it accept?</button>
        <button role="tab" className="chip" aria-pressed={tab === 'bug'} aria-selected={tab === 'bug'} onClick={() => setTab('bug')}>(c) Fix the bug</button>
      </div>
      {tab === 'predict' && <Predict hit={hit} />}
      {tab === 'accept' && <WillAccept hit={hit} openInLab={openInLab} />}
      {tab === 'bug' && <FixBug hit={hit} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* (a) Predict the next ID                                              */
/* ------------------------------------------------------------------ */
const DET = [ANBN, ANB2N, WCWR];
const PRED_INPUTS: Record<string, string[]> = {
  anbn: ['aabb', 'aaabbb', 'aab', 'abab', 'abb'],
  anb2n: ['aabbbb', 'abb', 'aabbb'],
  wcwr: ['abcba', 'bcb', 'abcab', 'aacaa'],
};

function newPuzzle() {
  const m = pick(DET);
  const w = pick(PRED_INPUTS[m.id]);
  const r = explore(m, w, m.mode);
  const path = pathTo(r, primaryLeaf(r)).map((id) => r.nodes[id]);
  return { m, w, path, v: verdict(r) };
}

function distractors(m: Machine, cur: Config, next: Config, t: Transition, w: string): string[] {
  const out = new Set<string>();
  const add = (c: Config) => out.add(fmtID(c, w));
  if (next.stack.length > 1) add({ ...next, stack: [...next.stack].reverse().join('') });
  add({ ...next, pos: t.read === '' ? Math.min(w.length, cur.pos + 1) : cur.pos });
  const other = m.states.filter((q) => q !== next.state);
  if (other.length) add({ ...next, state: pick(other) });
  add({ ...next, stack: cur.stack });
  if (t.push === '') add({ ...next, stack: cur.stack[0] + cur.stack });
  else add({ ...next, stack: cur.stack.slice(1) });
  out.delete(fmtID(next, w));
  return [...out];
}

function Predict({ hit }: { hit: (ok: boolean, pts?: number) => void }) {
  const [p, setP] = useState(newPuzzle);
  const [k, setK] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const cur = p.path[k];
  const last = k === p.path.length - 1;
  const next = last ? null : p.path[k + 1];
  const accepted = p.v.accepted;

  const HALT_ACC = 'No move — halt and ACCEPT';
  const HALT_REJ = 'No move — stuck, REJECT';
  const correct = next ? fmtID(next.config, p.w) : accepted ? HALT_ACC : HALT_REJ;
  const options = useMemo(() => {
    if (!next) return shuffle([HALT_ACC, HALT_REJ, ...distractors(p.m, cur.config, { ...cur.config, pos: Math.min(p.w.length, cur.config.pos + 1) }, p.m.transitions[0], p.w).slice(0, 1)]);
    const ds = shuffle(distractors(p.m, cur.config, next.config, next.via!, p.w)).slice(0, 2);
    return shuffle([correct, ...ds, HALT_REJ]);
  }, [p, k]); // eslint-disable-line

  const choose = (o: string) => {
    if (answer) return;
    setAnswer(o);
    hit(o === correct);
  };
  const submitTyped = () => {
    if (answer || !typed.trim()) return;
    const ok = next ? normID(typed) === normID(correct) : false;
    setAnswer(ok ? correct : `typed: ${typed}`);
    hit(ok, 15);
  };
  const advance = () => {
    setAnswer(null); setTyped('');
    if (last) { setP(newPuzzle()); setK(0); } else setK(k + 1);
  };

  return (
    <div className="two">
      <section className="panel">
        <div className="panel-title"><b>{p.m.name}</b><span>input {p.w} · {p.m.mode === 'final' ? 'final state' : 'empty stack'}</span></div>
        <div style={{ height: 200, display: 'flex' }}><Diagram machine={p.m} active={cur.config.state} compact /></div>
        <div className="delta-list" style={{ marginTop: 8, fontSize: '0.82rem', maxHeight: 180, overflow: 'auto' }}>
          {p.m.transitions.map((t) => <div key={t.id} className={`delta-item ${answer && next?.via?.id === t.id ? 'good' : ''}`}>{fmtDelta(t)}</div>)}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><b>Move {k + 1}</b><span>what comes after ⊢ ?</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', alignItems: 'end', gap: 10 }}>
          <StackTower stack={cur.config.stack} bottom={p.m.bottom} mini />
          <div className="bigq"><IDText c={cur.config} input={p.w} /> ⊢ <span className="muted">?</span></div>
        </div>
        <div className="options" style={{ marginTop: 10 }}>
          {options.map((o) => (
            <button key={o} className={`opt ${answer ? (o === correct ? 'right' : o === answer ? 'wrong' : '') : ''}`} onClick={() => choose(o)} disabled={!!answer}>{o}</button>
          ))}
        </div>
        {next && (
          <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); submitTyped(); }}>
            <input type="text" className="grow mono" placeholder="or type it: (q0, abb, XZ)  (+5 bonus)" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!answer} aria-label="Type the next ID" />
            <button className="btn small" disabled={!!answer}>submit</button>
          </form>
        )}
        <AnimatePresence>
          {answer && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`feedback ${answer === correct ? 'good' : 'bad'}`}>
              <b>{answer === correct ? 'Correct!' : 'Not quite.'}</b>{' '}
              {next ? <>The move is <span className="mono">{fmtDelta(next.via!)}</span>, giving <span className="mono">{correct}</span>. Remember: the stack is written <b>top first</b>, and an ε-move does not consume input.</>
                : <>{p.v.headline}: {p.v.reason}.</>}
              <div style={{ marginTop: 8 }}><button className="btn primary small" onClick={advance}>{last ? 'New puzzle →' : 'Next move →'}</button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* (b) Will it accept?                                                  */
/* ------------------------------------------------------------------ */
const POOL: Record<string, string[]> = {};
function pool(p: Preset) {
  if (!POOL[p.id]) POOL[p.id] = allStrings(p.inputAlphabet, p.inputAlphabet.length > 2 ? 5 : 7);
  return POOL[p.id];
}
function newRound() {
  const p = pick(PRESETS);
  const all = pool(p).filter((s) => s.length >= 2);
  const inL = all.filter(LANGUAGES[p.id]);
  const w = Math.random() < 0.5 && inL.length ? pick(inL) : pick(all.filter((s) => !LANGUAGES[p.id](s) && s.length <= 7));
  const r = explore(p, w, p.mode);
  return { p, w, v: verdict(r) };
}

function WillAccept({ hit, openInLab }: { hit: (ok: boolean) => void; openInLab: (id: string, w: string) => void }) {
  const [r, setR] = useState(newRound);
  const [guess, setGuess] = useState<boolean | null>(null);
  const answer = (g: boolean) => { if (guess !== null) return; setGuess(g); hit(g === r.v.accepted); };
  return (
    <section className="panel" style={{ maxWidth: 820 }}>
      <div className="panel-title"><b>{r.p.name}</b><span>{r.p.language} · accept by {r.p.mode === 'final' ? 'final state' : 'empty stack'}</span></div>
      <div className="formula" style={{ fontSize: '0.78rem', columns: 2 }}>{r.p.transitions.map((t) => <div key={t.id}>{fmtDelta(t)}</div>)}</div>
      <div className="bigq" style={{ fontSize: '2.2rem', letterSpacing: '0.2em' }}>{showSym(r.w)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" style={{ background: 'var(--accept)', borderColor: 'var(--accept)', minWidth: 140 }} onClick={() => answer(true)} disabled={guess !== null}>ACCEPT</button>
        <button className="btn primary" style={{ background: 'var(--reject)', borderColor: 'var(--reject)', minWidth: 140 }} onClick={() => answer(false)} disabled={guess !== null}>REJECT</button>
      </div>
      {guess !== null && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`feedback ${guess === r.v.accepted ? 'good' : 'bad'}`}>
          <b>{guess === r.v.accepted ? 'Right!' : 'Wrong.'}</b> {r.v.headline}: {r.v.reason}.
          {r.v.notes.map((n, i) => <div key={i} className="muted" style={{ fontSize: '0.85rem' }}>{n}</div>)}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary small" onClick={() => { setR(newRound()); setGuess(null); }}>Next round →</button>
            <button className="btn small" onClick={() => openInLab(r.p.id, r.w)}>Watch it run in the Lab</button>
          </div>
        </motion.div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* (c) Fix the bug                                                      */
/* ------------------------------------------------------------------ */
function FixBug({ hit }: { hit: (ok: boolean, pts?: number) => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [test, setTest] = useState(BUGS[0].tests[0]);
  const bug = BUGS[i];
  const solved = picked !== null && (bug.faulty === -1 ? picked === bug.correctCandidate : picked === bug.faulty);
  const choose = (k: number) => {
    if (picked !== null && solved) return;
    setPicked(k);
    const ok = bug.faulty === -1 ? k === bug.correctCandidate : k === bug.faulty;
    hit(ok, 20);
  };
  const go = (n: number) => { setI(n); setPicked(null); setTest(BUGS[n].tests[0]); };
  const badSet = solved && bug.faulty >= 0 ? new Set([bug.machine.transitions[bug.faulty].id]) : undefined;
  return (
    <div className="two">
      <section className="panel">
        <div className="panel-title"><b>Bug {i + 1}/{BUGS.length}: {bug.title}</b>
          <span className="row" style={{ gap: 4 }}>
            <button className="btn small" onClick={() => go((i - 1 + BUGS.length) % BUGS.length)}>‹</button>
            <button className="btn small" onClick={() => go((i + 1) % BUGS.length)}>›</button>
          </span>
        </div>
        <p>Intended language: <span className="mono">{bug.base.language}</span> ({bug.base.mode === 'final' ? 'final state' : 'empty stack'}).</p>
        <p className="warn">Symptom: {bug.symptom}</p>
        <p className="muted" style={{ fontSize: '0.9rem' }}>{bug.faulty === -1 ? 'One transition is MISSING. Which one must be added?' : 'Exactly one transition is wrong. Click it.'}</p>
        <div className="delta-list">
          {bug.faulty === -1
            ? <>
                {bug.machine.transitions.map((t) => <div key={t.id} className="delta-item">{fmtDelta(t)}</div>)}
                <div className="muted" style={{ margin: '6px 0 2px' }}>add which?</div>
                {bug.candidates!.map((c, k) => (
                  <button key={k} className={`delta-item ${picked === k ? (k === bug.correctCandidate ? 'good' : 'bad') : ''}`} onClick={() => choose(k)}>+ {c}</button>
                ))}
              </>
            : bug.machine.transitions.map((t, k) => (
                <button key={t.id} className={`delta-item ${picked === k ? (k === bug.faulty ? 'bad' : 'changed') : ''}`} onClick={() => choose(k)}>
                  {fmtDelta(t)} {picked === k && (k === bug.faulty ? ' ← the bug' : ' ← this one is fine')}
                </button>
              ))}
        </div>
        {picked !== null && (
          <div className={`feedback ${solved ? 'good' : 'bad'}`}>
            {solved ? <><b>Found it!</b> {bug.explain}<div style={{ marginTop: 8 }}><button className="btn primary small" onClick={() => go((i + 1) % BUGS.length)}>Next bug →</button></div></>
              : <><b>Not that one.</b> Run the failing string on the right and watch which transition misbehaves.</>}
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-title"><b>Test bench</b><span>run the broken machine</span></div>
        <div className="row" style={{ marginBottom: 8 }}>
          {bug.tests.map((t) => <button key={t} className="chip" aria-pressed={test === t} onClick={() => setTest(t)}>{t}</button>)}
        </div>
        <MiniRun key={`${i}-${test}`} machine={bug.machine} input={test} mode={bug.base.mode} diagram bad={badSet} />
      </section>
    </div>
  );
}
