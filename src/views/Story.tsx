import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { explore, pathTo, primaryLeaf } from '../engine/pda';
import { ANBN } from '../engine/presets';
import { sfx } from '../ui/sound';
import { StackTower } from '../ui/StackTower';

const SCENE_MS = [4200, 9000, 3200, 6500, 99999];

export function Story({ onDone }: { onDone: () => void }) {
  const [scene, setScene] = useState(0);
  const [fed, setFed] = useState(0); // a's fed to the finite automaton
  const [k, setK] = useState(0); // step in the PDA run
  const run = useMemo(() => {
    const r = explore(ANBN, 'aaabbb', 'final');
    return pathTo(r, primaryLeaf(r)).map((id) => r.nodes[id].config);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  // auto-advance scenes
  useEffect(() => {
    if (scene >= 4) return;
    const h = setTimeout(() => setScene((s) => s + 1), SCENE_MS[scene]);
    return () => clearTimeout(h);
  }, [scene]);

  // scene 1: auto-feed a's if the viewer doesn't click
  useEffect(() => {
    if (scene !== 1 || fed >= 3) return;
    const h = setTimeout(() => setFed((f) => f + 1), 1500);
    return () => clearTimeout(h);
  }, [scene, fed]);

  // scene 3: run the PDA
  useEffect(() => {
    if (scene !== 3) return;
    if (k >= run.length - 1) { sfx.accept(); return; }
    const h = setTimeout(() => { setK((x) => x + 1); sfx.push(); }, 620);
    return () => clearTimeout(h);
  }, [scene, k, run.length]);

  // finite automaton with p = 3 states: ε→s0, a→s1, aa→s2, aaa→s1 (pigeonhole!)
  const landing = [0, 1, 2, 1];
  const prefixes = ['ε', 'a', 'aa', 'aaa'];
  const at = landing[Math.min(fed, 3)];
  const who = (s: number) => prefixes.filter((_, i) => i <= fed && landing[i] === s);
  const clash = fed >= 3;

  const cfg = run[Math.min(k, run.length - 1)];
  const progress = Math.min(1, (scene + (scene < 4 ? 0.5 : 1)) / 4.5);

  return (
    <div className="story" role="dialog" aria-label="Introduction: why a stack">
      <button className="btn skip" onClick={onDone}>Skip intro (Esc)</button>
      <AnimatePresence mode="wait">
        {scene === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <p className="kicker">Session 13 proved it impossible for a finite automaton. Session 17 gave it a grammar.</p>
            <div className="big-lang">{'{'} aⁿbⁿ {'}'}</div>
            <p>Can a finite automaton accept it? Let’s give one a try.</p>
          </motion.div>
        )}
        {scene === 1 && (
          <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2>A finite automaton with 3 states reads a’s…</h2>
            <div className="stage">
              {[0, 1, 2].map((s) => (
                <motion.div key={s} className={`fa-state ${at === s ? (clash ? 'clash' : 'on') : ''}`} animate={at === s ? { scale: [1, 1.15, 1] } : {}}>
                  s{s}
                  <div className="who" style={{ color: clash && s === 1 ? 'var(--red)' : undefined }}>{who(s).join(' , ')}</div>
                </motion.div>
              ))}
            </div>
            {!clash ? (
              <>
                <p>It must remember how many a’s it has seen. Prefix so far: <b className="mono">{prefixes[fed]}</b></p>
                <button className="btn primary" onClick={() => { setFed((f) => Math.min(3, f + 1)); sfx.click(); }}>Feed it another a</button>
              </>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p style={{ color: 'var(--red)', fontWeight: 700 }}>Out of states! a and aaa land on the SAME state.</p>
                <p>So it treats <span className="mono">ab</span> and <span className="mono">aaab</span> identically — one is in L, one is not. Nothing about the design; everything about the count.</p>
              </motion.div>
            )}
          </motion.div>
        )}
        {scene === 2 && (
          <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2>One thing is added.</h2>
            <motion.div initial={{ y: -400, rotate: -8 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 12, delay: 0.3 }}
              className="story-stack">
              <span className="mono muted">stack</span>
            </motion.div>
            <p>A memory with no size limit — but you may only look at the top.</p>
          </motion.div>
        )}
        {scene === 3 && (
          <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2>Same idea, now with a stack: <span className="mono">aaabbb</span></h2>
            <div className="stage">
              <div className="tape" style={{ minHeight: 60 }}>
                {[...'aaabbb'].map((ch, i) => <div key={i} className={`cell ${i < cfg.pos ? 'read' : ''} ${i === cfg.pos ? 'current' : ''}`}>{ch}</div>)}
              </div>
              <div style={{ width: 220 }}><StackTower stack={cfg.stack} bottom="Z" bare /></div>
            </div>
            <p className="mono">( {cfg.state} , {'aaabbb'.slice(cfg.pos) || 'ε'} , {cfg.stack} )</p>
            {k >= run.length - 1 ? <p style={{ color: 'var(--ok)', fontWeight: 600, fontSize: '1.4rem' }}>Accepted — one X per a, popped by each b.</p> : <p>push an X per a… pop one per b…</p>}
          </motion.div>
        )}
        {scene === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="tagline"><span className="u">Unbounded in size,</span><br /><span className="r">severely restricted in access.</span></div>
            <p style={{ marginTop: 16 }}>That combination is the whole design of a pushdown automaton.</p>
            <button className="btn primary" style={{ marginTop: 20, fontSize: '1.1rem', padding: '12px 26px' }} onClick={onDone} autoFocus>Enter the lab</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="progress" style={{ width: `${progress * 100}%`, transition: 'width 0.6s' }} />
      {scene < 4 && <button className="btn small" style={{ position: 'absolute', bottom: 18, right: 18 }} onClick={() => setScene((s) => s + 1)}>next ›</button>}
    </div>
  );
}
