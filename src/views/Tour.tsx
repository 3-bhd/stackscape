import { useEffect } from 'react';
import { Playback } from '../ui/usePlayback';

export const TOUR_STEPS: { title: string; from: number; to: number; spot: string; body: string[] }[] = [
  {
    title: '1 · What to remember', from: 0, to: 0, spot: 'stack',
    body: [
      'L = { aⁿbⁿ : n ≥ 1 }. What must survive from the a’s to the b’s? Only HOW MANY — not which symbols, not in what order.',
      'Γ = { X, Z }: one X per a, and Z marks the bottom. The stack is a unary counter; Z is what makes “the count is back to zero” detectable.',
    ],
  },
  {
    title: '2 · The machine', from: 0, to: 0, spot: 'ctrl',
    body: [
      'M = ( {q0, q1, q2}, {a, b}, {X, Z}, δ, q0, Z, {q2} ) — five transitions.',
      'The switch from pushing to popping fires on the first b, which is visible: nothing is guessed, so the machine is deterministic. It accepts by final state.',
    ],
  },
  {
    title: '3 · Push the a’s', from: 0, to: 2, spot: 'stack',
    body: [
      'Stack: Z → XZ → XXZ. Two a’s read, two X’s on the stack, the marker still underneath. The state has not changed — the counting is all in the stack.',
      'Two pictures, one stack: the tower has the top at the TOP; the written ID has the top on the LEFT.',
    ],
  },
  {
    title: '4 · Pop against the b’s', from: 2, to: 4, spot: 'trace',
    body: [
      'Stack: XXZ → XZ → Z. The first b did two things: popped an X and moved to q1. From then on the machine is in the popping phase.',
      'q1 has no a-transition — that is what forbids an a after a b. Being stuck is rejection, not error.',
    ],
  },
  {
    title: '5 · Finish and accept', from: 4, to: 5, spot: 'play',
    body: [
      'δ(q1, ε, Z) = (q2, Z): the final ε-move checks that the stack came back down to Z — the same as checking the count reached zero.',
      'Input exhausted ✓  q2 ∈ F ✓  ACCEPT. Five moves for a four-symbol string: two pushes, two pops, one ε-move.',
    ],
  },
];

export function Tour({ step, setStep, pb, onClose }: { step: number; setStep: (n: number) => void; pb: Playback; onClose: () => void }) {
  const s = TOUR_STEPS[step];
  useEffect(() => {
    pb.setPlaying(false);
    pb.setIdx(s.from);
    const timers: number[] = [];
    for (let i = s.from + 1; i <= s.to; i++) timers.push(window.setTimeout(() => pb.setIdx(i), 900 * (i - s.from)));
    return () => timers.forEach(clearTimeout);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'PageDown' || e.key === 'n') setStep(Math.min(TOUR_STEPS.length - 1, step + 1));
      if (e.key === 'PageUp' || e.key === 'b') setStep(Math.max(0, step - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, setStep, onClose]);

  return (
    <aside className="tour" role="dialog" aria-label="Guided tour of aⁿbⁿ on aabb">
      <div className="tour-steps">{TOUR_STEPS.map((_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
      <div className="muted" style={{ fontSize: '0.75rem', marginTop: 8, letterSpacing: '0.12em' }}>GUIDED TOUR · aⁿbⁿ ON aabb · SLIDES 8–12</div>
      <h3>{s.title}</h3>
      {s.body.map((b, i) => <p key={i}>{b}</p>)}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn small" onClick={onClose}>End tour</button>
        <span className="grow" />
        <button className="btn small" disabled={step === 0} onClick={() => setStep(step - 1)}>‹ back</button>
        {step < TOUR_STEPS.length - 1
          ? <button className="btn primary small" onClick={() => setStep(step + 1)}>next ›</button>
          : <button className="btn primary small" onClick={onClose}>Done ✓</button>}
      </div>
    </aside>
  );
}
