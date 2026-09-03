/**
 * Small deterministic helpers shared by every engine stage.
 *
 * Nothing in the engine uses Math.random(). Given the same inputs, GrowthOS
 * produces byte-identical recommendations — which is what makes the reasoning
 * trace defensible rather than decorative.
 */

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalise a set of values against the largest one. Keeps ratios meaningful. */
export function normaliseToMax(values: number[]): number[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => clamp(v / max));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function safeDiv(a: number, b: number, fallback = 0): number {
  return b === 0 || !Number.isFinite(b) ? fallback : a / b;
}

/**
 * Round a set of percentages to whole numbers that still add to exactly 100.
 * Largest-remainder method — no allocation ever displays as 99% or 101%.
 */
export function roundSharesTo100(shares: number[]): number[] {
  if (shares.length === 0) return [];
  const floors = shares.map((s) => Math.floor(s));
  let remainder = 100 - sum(floors);
  const order = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  let k = 0;
  while (remainder > 0 && order.length > 0) {
    out[order[k % order.length].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return out;
}

/** Deterministic id from a string — used for reasoning nodes and findings. */
export function slugId(prefix: string, ...parts: (string | number)[]): string {
  return [prefix, ...parts]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function pctDelta(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}
