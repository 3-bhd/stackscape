import { useCallback, useEffect, useRef, useState } from 'react';

/** Step-through playback over `length` positions (0 … length-1). */
export function usePlayback(length: number, resetKey: unknown) {
  const [idx, setIdxRaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // steps per second
  const lenRef = useRef(length);
  lenRef.current = length;

  useEffect(() => {
    setIdxRaw(0);
    setPlaying(false);
  }, [resetKey]);

  const setIdx = useCallback((i: number) => setIdxRaw(Math.max(0, Math.min(lenRef.current - 1, i))), []);
  const forward = useCallback(() => setIdxRaw((i) => Math.min(lenRef.current - 1, i + 1)), []);
  const back = useCallback(() => { setPlaying(false); setIdxRaw((i) => Math.max(0, i - 1)); }, []);
  const reset = useCallback(() => { setPlaying(false); setIdxRaw(0); }, []);
  const end = useCallback(() => { setPlaying(false); setIdxRaw(lenRef.current - 1); }, []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setIdxRaw((i) => (i >= lenRef.current - 1 ? 0 : i));
      return !p;
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (idx >= length - 1) { setPlaying(false); return; }
    const h = setTimeout(forward, 1000 / speed);
    return () => clearTimeout(h);
  }, [playing, idx, length, speed, forward]);

  return { idx, setIdx, playing, setPlaying, toggle, forward, back, reset, end, speed, setSpeed, atEnd: idx >= length - 1 };
}
export type Playback = ReturnType<typeof usePlayback>;
