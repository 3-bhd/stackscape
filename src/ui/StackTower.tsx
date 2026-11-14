import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { showSym } from '../engine/pda';
import { useSettings } from './settings';

const FIXED: Record<string, string> = {
  X: 'var(--sym-1)', A: 'var(--sym-1)', B: 'var(--sym-2)', P: 'var(--sym-3)', N: 'var(--sym-2)', Y: 'var(--sym-4)', W: 'var(--sym-5)',
};
const PALETTE = ['var(--sym-1)', 'var(--sym-2)', 'var(--sym-3)', 'var(--sym-4)', 'var(--sym-5)', 'var(--sym-6)'];
export function colorFor(sym: string): string {
  if (FIXED[sym]) return FIXED[sym];
  let h = 0;
  for (const ch of sym) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

interface Props {
  /** whole stack, top first */
  stack: string;
  bottom: string;
  mini?: boolean;
  /** hide the "written as" footer */
  bare?: boolean;
  maxVisible?: number;
}

export function StackTower({ stack, bottom, mini, bare, maxVisible }: Props) {
  const { reducedMotion } = useSettings();
  const prev = useRef(stack);
  const [burst, setBurst] = useState<{ id: number; kind: 'push' | 'pop' | 'swap'; color: string } | null>(null);
  const prevStack = prev.current;

  useEffect(() => {
    const p = prev.current;
    if (p !== stack && !mini && !reducedMotion) {
      const kind = stack.length > p.length ? 'push' : stack.length < p.length ? 'pop' : 'swap';
      const color = colorFor(kind === 'pop' ? p[0] ?? bottom : stack[0] ?? bottom);
      setBurst({ id: Date.now(), kind, color });
    }
    prev.current = stack;
  }, [stack, mini, reducedMotion, bottom]);

  const n = stack.length;
  const limit = maxVisible ?? (mini ? 8 : 12);
  const hidden = Math.max(0, n - limit);
  // index from the bottom gives every block a stable identity
  const blocks = [...stack].map((sym, i) => ({ sym, fromBottom: n - 1 - i, isTop: i === 0 }));
  const visible = hidden ? [...blocks.slice(0, limit - 1), null, blocks[n - 1]] : blocks;

  const spring = reducedMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 26, mass: 0.8 };

  return (
    <div className={`stackbox ${mini ? 'mini' : ''}`}>
      <div className="tower-zone" style={mini ? { minHeight: 60, paddingTop: 8 } : undefined}>
        <div className="tower" aria-label={`Stack, top first: ${showSym(stack)}`} role="img">
          {burst && !mini && <Burst key={burst.id} kind={burst.kind} color={burst.color} />}
          <AnimatePresence mode="popLayout" initial={false}>
            {n === 0 && (
              <motion.div key="empty" className="empty-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {mini ? 'ε' : <>empty<br /><small>(Z gone too)</small></>}
              </motion.div>
            )}
            {visible.map((b) => {
              if (!b) return <div key="more" className="dim mono" style={{ fontSize: mini ? 10 : 12 }}>⋮ {hidden} more</div>;
              const isBottom = b.fromBottom === 0 && b.sym === bottom;
              const key = `${b.fromBottom}:${b.sym}`;
              const wasThere = b.fromBottom < prevStack.length;
              const c = colorFor(b.sym);
              return (
                <motion.div
                  key={key}
                  layout={!reducedMotion}
                  className={`block ${isBottom ? 'bottom' : ''}`}
                  style={isBottom ? undefined : { background: c }}
                  initial={reducedMotion ? false : wasThere ? { rotateY: 90, opacity: 0.2 } : { y: mini ? -40 : -160, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, x: 0, opacity: 1, scale: 1, rotateY: 0, rotate: 0 }}
                  exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { x: mini ? 40 : 150, y: mini ? -30 : -120, rotate: 28, opacity: 0, transition: { duration: 0.38 } }}
                  transition={spring}
                >
                  {isBottom && <span className="anchor" aria-hidden>bottom</span>}
                  {b.sym}
                  {b.isTop && <span className="toplabel">← top</span>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      <div className="ground" style={{ margin: '0 auto', width: mini ? 70 : undefined }} />
      {!bare && !mini && (
        <div className="stack-foot">
          <span>
            in the ID: <span className="written">{n ? <><span className="topsym">{stack[0]}</span>{stack.slice(1)}</> : 'ε'}</span>{' '}
            <span className="muted">(top is leftmost)</span>
          </span>
          <span className="height-badge" title="stack height">h = {n}</span>
        </div>
      )}
    </div>
  );
}

function Burst({ kind, color }: { kind: 'push' | 'pop' | 'swap'; color: string }) {
  const parts = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div style={{ position: 'absolute', top: kind === 'push' ? 6 : -6, left: '50%', width: 0, height: 0, zIndex: 3 }} aria-hidden>
      {parts.map((i) => {
        const ang = (i / parts.length) * Math.PI * 2;
        const dist = kind === 'pop' ? 70 : 46;
        return (
          <motion.span
            key={i}
            className="particle"
            style={{ background: color }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * (kind === 'pop' ? 0.9 : 0.5) - (kind === 'pop' ? 20 : 0), opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}
