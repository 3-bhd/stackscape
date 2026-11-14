import { MotionConfig } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { decodeFromUrl, encodeForUrl, parseMachine, serializeMachine } from './engine/parse';
import { ANBN, presetById, Preset } from './engine/presets';
import { AcceptMode, Machine } from './engine/types';
import { load, save, SettingsCtx } from './ui/settings';
import { setSoundEnabled, sfx } from './ui/sound';
import { useSim } from './ui/useSim';
import { Challenge } from './views/Challenge';
import { Compare } from './views/Compare';
import { Editor } from './views/Editor';
import { Lab } from './views/Lab';
import { Mistakes } from './views/Mistakes';
import { Multiverse } from './views/Multiverse';
import { Story } from './views/Story';
import { Tour, TOUR_STEPS } from './views/Tour';

const VIEWS: [string, string][] = [
  ['lab', 'Lab'],
  ['multiverse', 'Multiverse ⑂'],
  ['compare', 'wcwᴿ vs wwᴿ'],
  ['challenge', 'Challenge 🎮'],
  ['mistakes', 'Common mistakes'],
  ['editor', 'Editor ✎'],
];

interface Init { view: string; machine: Machine; input: string; mode: AcceptMode; customText: string | null; step: number; present: boolean; intro: boolean | null }

function readHash(): Init {
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  let machine: Machine = ANBN;
  let customText: string | null = null;
  const m = h.get('m');
  if (m) {
    const txt = decodeFromUrl(m);
    const r = txt ? parseMachine(txt) : null;
    if (r?.machine) { machine = r.machine; customText = txt; }
  } else {
    const p = presetById(h.get('p') ?? '');
    if (p) machine = p;
  }
  const preset = presetById(machine.id);
  const w = h.get('w');
  const mode = (h.get('mode') === 'empty' ? 'empty' : h.get('mode') === 'final' ? 'final' : machine.mode) as AcceptMode;
  const view = VIEWS.some(([v]) => v === h.get('view')) ? h.get('view')! : 'lab';
  const step = Math.max(0, parseInt(h.get('t') ?? '0', 10) || 0);
  const intro = h.get('intro') === '0' ? false : h.get('intro') === '1' ? true : null;
  return { view, machine, input: w ?? preset?.demos[0].input ?? '', mode, customText, step, present: h.get('present') === '1', intro };
}

export default function App() {
  const [init] = useState(readHash);
  const [view, setView] = useState(init.view);
  const [machine, setMachine] = useState<Machine>(init.machine);
  const [customText, setCustomText] = useState<string | null>(init.customText);
  const [input, setInput] = useState(init.input);
  const [mode, setMode] = useState<AcceptMode>(init.mode);
  const [sound, setSound] = useState(() => load('sound', false));
  const [reduced, setReduced] = useState(() => load('reducedMotion', typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [present, setPresent] = useState(init.present);
  const [story, setStory] = useState(() => init.intro ?? (!load('seenStory', false) && !location.hash.includes('m=')));
  const [tour, setTour] = useState<number | null>(null);

  const sim = useSim(machine, input, mode);

  useEffect(() => { setSoundEnabled(sound); save('sound', sound); }, [sound]);
  useEffect(() => { save('reducedMotion', reduced); }, [reduced]);
  useEffect(() => { document.documentElement.classList.toggle('present', present); }, [present]);

  // keep the URL shareable
  useEffect(() => {
    const h = new URLSearchParams();
    h.set('view', view);
    if (machine.id === 'custom' && customText) h.set('m', encodeForUrl(customText));
    else h.set('p', machine.id);
    h.set('w', input);
    h.set('mode', mode);
    history.replaceState(null, '', '#' + h.toString());
  }, [view, machine, input, mode, customText]);

  // global keys: P = presentation mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P') setPresent((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pickPreset = useCallback((p: Preset) => {
    setMachine(p); setCustomText(null); setMode(p.mode); setInput(p.demos[0].input); sfx.click();
  }, []);
  const goto = useCallback((v: string) => { setView(v); window.scrollTo({ top: 0 }); }, []);

  const startTour = () => {
    setMachine(ANBN); setCustomText(null); setMode('final'); setInput('aabb'); setView('lab'); setTour(0);
  };
  const closeStory = () => { setStory(false); save('seenStory', true); };

  return (
    <SettingsCtx.Provider value={{ sound, reducedMotion: reduced, present }}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
        <div className="app">
          <header className="topbar">
            <div className="logo" aria-label="Stackscape">
              <span className="glyph" aria-hidden><i /><i /><i /></span>
              <span>STACK<b>SCAPE</b></span>
            </div>
            <nav className="nav hide-present" aria-label="Views">
              {VIEWS.map(([v, label]) => (
                <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => { setTour(null); goto(v); }}>{label}</button>
              ))}
            </nav>
            {present && <div className="grow mono muted" style={{ fontSize: '0.9rem' }}>{machine.name} · {machine.language}</div>}
            <div className="tools">
              <button className="iconbtn hide-present" onClick={startTour} title="Guided tour: aⁿbⁿ on aabb in the slides’ five steps">▶ Tour</button>
              <button className="iconbtn hide-present" onClick={() => setStory(true)} title="Replay the intro story">Intro</button>
              <button className="iconbtn" aria-pressed={present} onClick={() => setPresent((p) => !p)} title="Presentation mode (P)">⛶ Present</button>
              <button className="iconbtn" aria-pressed={sound} onClick={() => setSound((s) => !s)} title="Sound effects">{sound ? '🔊' : '🔇'}<span className="sr-only">sound</span></button>
              <button className="iconbtn hide-present" aria-pressed={reduced} onClick={() => setReduced((r) => !r)} title="Reduce motion">{reduced ? 'motion: low' : 'motion: on'}</button>
            </div>
          </header>
          <main>
            {view === 'lab' && (
              <Lab machine={machine} input={input} mode={mode} sim={sim} setInput={setInput} setMode={setMode} pickPreset={pickPreset} goto={goto}
                spotlight={tour !== null ? TOUR_STEPS[tour].spot : null} tourActive={tour !== null} initialStep={init.step} />
            )}
            {view === 'multiverse' && (
              <Multiverse machine={machine} input={input} mode={mode} sim={sim} setInput={setInput}
                pickPreset={(id) => { const p = presetById(id)!; pickPreset(p); if (id === 'wwr') setInput('abba'); }} goto={goto} />
            )}
            {view === 'compare' && <Compare />}
            {view === 'challenge' && <Challenge openInLab={(id, w) => { const p = presetById(id)!; pickPreset(p); setInput(w); goto('lab'); }} />}
            {view === 'mistakes' && <Mistakes />}
            {view === 'editor' && (
              <Editor current={machine} onUse={(m, text) => { setMachine({ ...m }); setCustomText(text); setMode(m.mode); setInput(''); goto('lab'); }} />
            )}
          </main>
          <footer className="footer hide-present">
            STACKSCAPE · a pushdown automaton simulator for CSCE 4201 Theory of Computing (Session 20) · conventions: M = (Q, Σ, Γ, δ, q₀, Z₀, F), IDs (q, w, α) with the stack written top first
          </footer>
          {tour !== null && view === 'lab' && <Tour step={tour} setStep={setTour} pb={sim.pb} onClose={() => setTour(null)} />}
          {story && <Story onDone={closeStory} />}
        </div>
      </MotionConfig>
    </SettingsCtx.Provider>
  );
}

export { serializeMachine };
