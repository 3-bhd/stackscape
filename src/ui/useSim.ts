import { useMemo, useState } from 'react';
import { accepts, explore, pathTo, primaryLeaf, RunResult, verdict } from '../engine/pda';
import { AcceptMode, Machine } from '../engine/types';
import { Step } from './Panels';
import { usePlayback } from './usePlayback';

export function inputProblem(m: Machine, input: string): string | null {
  const bad = [...new Set([...input].filter((ch) => !m.inputAlphabet.includes(ch)))];
  if (bad.length) return `"${bad.join('", "')}" ${bad.length === 1 ? 'is' : 'are'} not in Σ = {${m.inputAlphabet.join(', ')}}`;
  if (input.length > 40) return 'keep inputs to 40 symbols or fewer';
  return null;
}

export function useSim(machine: Machine, input: string, mode: AcceptMode) {
  const problem = inputProblem(machine, input);
  const run: RunResult | null = useMemo(() => (problem ? null : explore(machine, input, mode)), [machine, input, mode, problem]);
  const [sel, setSel] = useState<{ run: RunResult | null; leaf: number } | null>(null);
  const leafId = run ? (sel && sel.run === run ? sel.leaf : primaryLeaf(run)) : 0;
  const steps: Step[] = useMemo(
    () => (run ? pathTo(run, leafId).map((id) => ({ config: run.nodes[id].config, via: run.nodes[id].via })) : [{ config: { state: machine.start, pos: 0, stack: machine.bottom }, via: null }]),
    [run, leafId, machine],
  );
  const pb = usePlayback(steps.length, `${run ? 'r' : 'x'}|${machine.id}|${machine.transitions.length}|${input}|${mode}|${leafId}`);
  const both = useMemo(
    () => (problem ? { final: false, empty: false } : { final: accepts(machine, input, 'final'), empty: accepts(machine, input, 'empty') }),
    [machine, input, problem],
  );
  const v = run ? verdict(run, leafId) : null;
  const leafNode = run ? run.nodes[leafId] : null;
  const selectLeaf = (id: number) => setSel({ run, leaf: id });
  return { problem, run, leafId, leafNode, steps, pb, both, verdict: v, selectLeaf };
}
export type Sim = ReturnType<typeof useSim>;
