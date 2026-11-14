import { pathTo, RunResult } from './pda';

/** How many symbols had been read when this branch first took an ε-move (its "guess"). */
export function firstEps(run: RunResult, leafId: number): number {
  for (const id of pathTo(run, leafId)) {
    const n = run.nodes[id];
    if (n.via?.read === '' && n.parent !== null) return run.nodes[n.parent].config.pos;
  }
  return Infinity;
}

export function branchLabel(run: RunResult, leafId: number): string {
  const k = firstEps(run, leafId);
  if (k === Infinity) return 'no ε-move';
  return `${run.machine.id === 'wwr' ? 'guess' : 'first ε-move'} after ${k} symbol${k === 1 ? '' : 's'}`;
}

