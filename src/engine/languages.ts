/**
 * Membership predicates written independently of the PDA engine,
 * used to brute-force check that each preset accepts exactly its language.
 */
const rev = (s: string) => [...s].reverse().join('');
const count = (s: string, ch: string) => [...s].filter((c) => c === ch).length;

export const LANGUAGES: Record<string, (w: string) => boolean> = {
  anbn: (w) => {
    const n = w.length / 2;
    return w.length >= 2 && Number.isInteger(n) && w === 'a'.repeat(n) + 'b'.repeat(n);
  },
  anb2n: (w) => {
    const n = w.length / 3;
    return w.length >= 3 && Number.isInteger(n) && w === 'a'.repeat(n) + 'b'.repeat(2 * n);
  },
  wcwr: (w) => {
    if (count(w, 'c') !== 1) return false;
    const [x, y] = w.split('c');
    return y === rev(x);
  },
  wwr: (w) => w.length % 2 === 0 && w === rev(w),
  eqab: (w) => count(w, 'a') === count(w, 'b'),
};

export function allStrings(alphabet: string[], maxLen: number): string[] {
  const out: string[] = [''];
  let layer = [''];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const s of layer) for (const a of alphabet) next.push(s + a);
    out.push(...next);
    layer = next;
  }
  return out;
}
