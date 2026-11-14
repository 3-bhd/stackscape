import { fmtDelta, fmtID, showSym, unread } from './pda';
import { Config, Transition } from './types';

export interface TraceLine {
  config: Config;
  via: Transition | null;
}

export function traceText(lines: TraceLine[], input: string, footer?: string): string {
  const ids = lines.map((l) => fmtID(l.config, input));
  const w = Math.max(...ids.map((s) => s.length));
  const out = lines.map((l, i) => {
    const id = ids[i].padEnd(w);
    return i === 0 ? `  ${id}` : `⊢ ${id}   ${fmtDelta(l.via!)}`;
  });
  out.unshift('stack written TOP FIRST (leftmost symbol = top)');
  if (footer) out.push(footer);
  return out.join('\n');
}

const tex = (s: string) => (s === '' ? '\\varepsilon' : `\\mathtt{${s}}`);

export function traceLatex(lines: TraceLine[], input: string, footer?: string): string {
  const row = (c: Config) => `(${c.state.replace(/^q(\d+)$/, 'q_{$1}')},\\ ${tex(unread(input, c.pos))},\\ ${tex(c.stack)})`;
  const d = (t: Transition) =>
    `\\delta(${t.from.replace(/^q(\d+)$/, 'q_{$1}')}, ${t.read === '' ? '\\varepsilon' : t.read}, ${t.top}) = (${t.to.replace(/^q(\d+)$/, 'q_{$1}')}, ${tex(t.push)})`;
  const body = lines
    .map((l, i) => (i === 0 ? `  & ${row(l.config)} && \\\\` : `\\vdash & ${row(l.config)} && ${d(l.via!)} \\\\`))
    .join('\n');
  return [
    '% stack written top first',
    '\\begin{align*}',
    body,
    '\\end{align*}',
    ...(footer ? [`% ${footer}`] : []),
  ].join('\n');
}

export { showSym };
