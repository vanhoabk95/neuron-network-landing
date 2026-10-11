import type { Layer, Pass } from "./model";

export type Selection = { layer: number; index: number };
export type Point = readonly [number, number];
export const GRAPH = { width: 800, height: 530 };
export const MOBILE_GRAPH = { width: 800, height: 1170 };
export const X = [38, 326, 504, 678];
export const COUNTS = [784, 16, 16, 10];

export function pointOf(layer: number, index: number, mobile = false): Point {
  if (mobile) {
    if (layer === 0) return [255 + (index % 28) * 10.8, 120 + Math.floor(index / 28) * 10.8];
    if (layer === 3) return [140 + index * 58, 980];
    return [85 + index * 42, layer === 1 ? 590 : 790];
  }
  if (layer === 0) return [X[0] + (index % 28) * 4.8, 194 + Math.floor(index / 28) * 4.8];
  return [X[layer], 266 + (index - (COUNTS[layer] - 1) / 2) * 24];
}

// Routing changes with layout; source, target and weight never change.
export function routeOf(layer: number, from: number, to: number, mobile = false): Point[] {
  const a = pointOf(layer, from, mobile);
  const b = pointOf(layer + 1, to, mobile);
  if (mobile) {
    const bend = (b[1] - a[1]) * 0.44;
    return [a, [a[0], a[1] + bend], [b[0], b[1] - bend], b];
  }
  const bend = (b[0] - a[0]) * 0.44;
  return [a, [a[0] + bend, a[1]], [b[0] - bend, b[1]], b];
}

export const pathOf = (points: Point[]) => `M${points[0].join(" ")} C${points.slice(1).map((p) => p.join(" ")).join(" ")}`;
export function valuesOf(pass: Pass | null): Float32Array[] {
  return pass ? [pass.input, pass.h1, pass.h2, pass.probs] : COUNTS.map((n) => new Float32Array(n));
}

// Keep motion legible: trace the strongest real incoming contribution per neuron.
// Negative contributions still arrive; a zero ReLU activation cannot send a signal.
export type Signal = { layer: number; from: number; to: number; contribution: number; strength: number };
export const INFERENCE_INTERVAL = 500;
export const FLOW = { leg: 360, interval: 1500, settle: 280 };
export function signalsOf(layers: Layer[], pass: Pass): Signal[] {
  const values = valuesOf(pass);
  return layers.flatMap((layer, li) => {
    const signals: Signal[] = [];
    let largest = 0;
    for (let to = 0; to < layer.out; to++) {
      let contribution = 0;
      let from = 0;
      for (let source = 0; source < layer.in; source++) {
        const candidate = layer.w[source * layer.out + to] * values[li][source];
        if (Math.abs(candidate) > Math.abs(contribution)) { contribution = candidate; from = source; }
      }
      if (contribution !== 0) {
        largest = Math.max(largest, Math.abs(contribution));
        signals.push({ layer: li, from, to, contribution, strength: 0 });
      }
    }
    return signals.map((signal) => ({ ...signal, strength: Math.abs(signal.contribution) / largest }));
  });
}
