import { useMemo } from 'react';
import { fmtArrow } from '../engine/pda';
import { Machine, Transition } from '../engine/types';

interface Props {
  machine: Machine;
  active?: string | null;
  fired?: string | null;
  bad?: Set<string>;
  marked?: Set<string>;
  onPickTransition?: (t: Transition) => void;
  compact?: boolean;
  title?: string;
}

const R = 30;
const LH = 16;

interface Pt { x: number; y: number }

function order(m: Machine): string[] {
  const seen: string[] = [m.start];
  for (let i = 0; i < seen.length; i++) {
    for (const t of m.transitions) if (t.from === seen[i] && !seen.includes(t.to)) seen.push(t.to);
  }
  for (const s of m.states) if (!seen.includes(s)) seen.push(s);
  return seen.filter((s) => m.states.includes(s));
}

export function Diagram({ machine: m, active, fired, bad, marked, onPickTransition, compact, title }: Props) {
  const geo = useMemo(() => {
    const ord = order(m);
    const pos = new Map<string, Pt>();
    const n = ord.length;
    if (n <= 5) {
      ord.forEach((s, i) => pos.set(s, { x: i * 230, y: 0 }));
    } else {
      const rad = 60 + n * 34;
      ord.forEach((s, i) => {
        const a = Math.PI + (i / n) * Math.PI * 2;
        pos.set(s, { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.72 });
      });
    }
    const groups = new Map<string, Transition[]>();
    for (const t of m.transitions) {
      const k = `${t.from}→${t.to}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }
    const idx = new Map(ord.map((s, i) => [s, i]));
    const edges: { key: string; d: string; labels: Transition[]; lx: number; ly: number; anchor: 'above' | 'below' | 'mid'; ts: Transition[] }[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const grow = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
    for (const p of pos.values()) { grow(p.x - R - 10, p.y - R - 10); grow(p.x + R + 10, p.y + R + 10); }
    const center = [...pos.values()].reduce((a, p) => ({ x: a.x + p.x / n, y: a.y + p.y / n }), { x: 0, y: 0 });

    for (const [k, ts] of groups) {
      const [from, to] = k.split('→');
      const a = pos.get(from)!, b = pos.get(to)!;
      const labelW = Math.max(...ts.map((t) => fmtArrow(t).length)) * 7.9 + 12;
      if (from === to) {
        // self loop pointing away from the centre of the drawing
        let dx = a.x - center.x, dy = a.y - center.y;
        const len = Math.hypot(dx, dy);
        if (n <= 5 || len < 1) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }
        // for a horizontal layout alternate loops above/below to spread labels
        if (n <= 5 && n > 1 && idx.get(from)! % 2 === 1) dy = 1;
        const ang = Math.atan2(dy, dx);
        const p1 = { x: a.x + Math.cos(ang - 0.45) * R, y: a.y + Math.sin(ang - 0.45) * R };
        const p2 = { x: a.x + Math.cos(ang + 0.45) * R, y: a.y + Math.sin(ang + 0.45) * R };
        const c1 = { x: a.x + Math.cos(ang - 0.6) * (R + 62), y: a.y + Math.sin(ang - 0.6) * (R + 62) };
        const c2 = { x: a.x + Math.cos(ang + 0.6) * (R + 62), y: a.y + Math.sin(ang + 0.6) * (R + 62) };
        const d = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
        const tip = { x: a.x + dx * (R + 52), y: a.y + dy * (R + 52) };
        const anchor = dy < -0.3 ? 'above' : dy > 0.3 ? 'below' : 'mid';
        edges.push({ key: k, d, labels: ts, lx: tip.x, ly: tip.y, anchor, ts });
        const h = ts.length * LH;
        if (anchor === 'above') { grow(tip.x - labelW / 2, tip.y - h - 6); grow(tip.x + labelW / 2, tip.y); }
        else if (anchor === 'below') { grow(tip.x - labelW / 2, tip.y); grow(tip.x + labelW / 2, tip.y + h + 10); }
        else { grow(tip.x - labelW / 2, tip.y - h / 2); grow(tip.x + labelW / 2, tip.y + h / 2); grow(tip.x, tip.y); }
        grow(c1.x, c1.y); grow(c2.x, c2.y);
        continue;
      }
      const hasRev = groups.has(`${to}→${from}`);
      const dist = Math.abs(idx.get(from)! - idx.get(to)!);
      const vx = b.x - a.x, vy = b.y - a.y;
      const L = Math.hypot(vx, vy) || 1;
      const nx = -vy / L, ny = vx / L; // left normal
      let bend = 0;
      if (hasRev) bend = 46;
      if (n <= 5 && dist > 1) bend = 60 * (dist - 1) + (hasRev ? 30 : 0);
      // forward edges bend up (negative y), backward edges bend down
      const sign = n <= 5 ? (idx.get(from)! < idx.get(to)! ? -1 : 1) * (ny < 0 ? -1 : 1) : 1;
      const mid = { x: (a.x + b.x) / 2 + nx * bend * sign, y: (a.y + b.y) / 2 + ny * bend * sign };
      const ua = { x: mid.x - a.x, y: mid.y - a.y }, la = Math.hypot(ua.x, ua.y) || 1;
      const ub = { x: mid.x - b.x, y: mid.y - b.y }, lb = Math.hypot(ub.x, ub.y) || 1;
      const s = { x: a.x + (ua.x / la) * R, y: a.y + (ua.y / la) * R };
      const e = { x: b.x + (ub.x / lb) * (R + 4), y: b.y + (ub.y / lb) * (R + 4) };
      const d = bend ? `M ${s.x} ${s.y} Q ${mid.x} ${mid.y} ${e.x} ${e.y}` : `M ${s.x} ${s.y} L ${e.x} ${e.y}`;
      const peak = { x: 0.25 * s.x + 0.5 * mid.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * mid.y + 0.25 * e.y };
      const goesUp = peak.y < (a.y + b.y) / 2 - 1 || (!bend && true);
      const anchor = goesUp ? 'above' : 'below';
      const ly = goesUp ? peak.y - 6 : peak.y + 8;
      edges.push({ key: k, d, labels: ts, lx: peak.x, ly, anchor, ts });
      const h = ts.length * LH;
      grow(peak.x - labelW / 2, goesUp ? ly - h : ly);
      grow(peak.x + labelW / 2, goesUp ? ly : ly + h + 6);
      grow(mid.x, mid.y);
    }
    const startPos = pos.get(m.start);
    if (startPos) grow(startPos.x - R - 50, startPos.y);
    const pad = 14;
    return { pos, edges, vb: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}` };
  }, [m]);

  const sp = geo.pos.get(m.start);
  const firedT = m.transitions.find((t) => t.id === fired);

  return (
    <svg className="diagram" viewBox={geo.vb} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={title ?? `State diagram of ${m.name}. Current state ${active ?? 'none'}.`}
      style={compact ? { minHeight: 120 } : undefined}>
      <defs>
        <filter id="glow" filterUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
        </marker>
        <marker id="arr-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="arrowhead hot" />
        </marker>
      </defs>
      {sp && (
        <g className="edge">
          <path d={`M ${sp.x - R - 46} ${sp.y} L ${sp.x - R - 4} ${sp.y}`} markerEnd="url(#arr)" />
          <text className="lbl" x={sp.x - R - 30} y={sp.y - 8} style={{ fontSize: 11 }}>start</text>
        </g>
      )}
      {geo.edges.map((e) => {
        const isFired = !!firedT && e.ts.some((t) => t.id === firedT.id);
        const isBad = !!bad && e.ts.some((t) => bad.has(t.id));
        const h = e.labels.length * LH;
        const y0 = e.anchor === 'above' ? e.ly - h + LH - 4 : e.anchor === 'below' ? e.ly + LH - 2 : e.ly - h / 2 + LH - 4;
        return (
          <g key={e.key} className={`edge ${isFired ? 'fired' : ''} ${isBad ? 'bad' : ''}`}>
            <path d={e.d} markerEnd={isFired ? 'url(#arr-hot)' : 'url(#arr)'} />
            {e.labels.map((t, i) => {
              const cls = t.id === fired ? 'fired' : bad?.has(t.id) ? 'bad' : marked?.has(t.id) ? 'mark' : '';
              const txt = fmtArrow(t);
              const w = txt.length * 7.9 + 8;
              return (
                <g key={t.id} onClick={onPickTransition ? () => onPickTransition(t) : undefined} style={onPickTransition ? { cursor: 'pointer' } : undefined}>
                  <rect className="lbl-bg" x={e.lx - w / 2} y={y0 + i * LH - 12} width={w} height={LH - 1} rx={4} />
                  <text className={`lbl ${cls}`} x={e.lx} y={y0 + i * LH}>{txt}</text>
                </g>
              );
            })}
          </g>
        );
      })}
      {m.states.map((s) => {
        const p = geo.pos.get(s)!;
        const fin = m.finals.includes(s);
        return (
          <g key={s} className={`state ${s === active ? 'active' : ''} ${fin ? 'final' : ''}`} transform={`translate(${p.x} ${p.y})`}>
            <circle className="ring" r={R} />
            {fin && <circle className="inner" r={R - 5} />}
            <text>{s}</text>
          </g>
        );
      })}
    </svg>
  );
}
