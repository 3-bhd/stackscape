/** Tiny synthesized sound effects (WebAudio). Off by default; no files, works offline. */
let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on && !ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, slide = 0, delay = 0) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  push: () => tone(330, 0.12, 'triangle', 0.09, -120),
  pop: () => tone(520, 0.12, 'triangle', 0.08, 380),
  swap: () => tone(440, 0.1, 'square', 0.04),
  eps: () => tone(880, 0.08, 'sine', 0.04),
  accept: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, 0, i * 0.09)); },
  stuck: () => { tone(220, 0.25, 'sawtooth', 0.05, -80); tone(165, 0.35, 'sawtooth', 0.05, -60, 0.15); },
  click: () => tone(1200, 0.03, 'square', 0.02),
};
