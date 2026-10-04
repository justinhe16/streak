/**
 * Week score → color. A smooth red → yellow → green ramp in oklch, so lightness
 * and chroma stay even across the blend (no muddy brown at the midpoint the way
 * an sRGB lerp gets). Components tint with it via `color-mix` against palette
 * tokens, so the same hue reads correctly on every palette in light and dark.
 */

type Stop = { at: number; l: number; c: number; h: number };

const STOPS: Stop[] = [
  { at: 0, l: 0.63, c: 0.2, h: 25 }, // red
  { at: 0.5, l: 0.82, c: 0.165, h: 85 }, // yellow
  { at: 1, l: 0.72, c: 0.18, h: 148 }, // green
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function scoreLch(score: number): { l: number; c: number; h: number } {
  const s = Math.min(1, Math.max(0, score));
  const i = s >= STOPS[1].at ? 1 : 0;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = (s - a.at) / (b.at - a.at);
  return { l: lerp(a.l, b.l, t), c: lerp(a.c, b.c, t), h: lerp(a.h, b.h, t) };
}

/** Solid `oklch(...)` for a score, or null for "nothing to score" (rendered neutral). */
export function scoreColor(score: number | null): string | null {
  if (score === null) return null;
  const { l, c, h } = scoreLch(score);
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}
