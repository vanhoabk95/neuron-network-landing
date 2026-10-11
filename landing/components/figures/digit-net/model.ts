// The figure's network: a 784-16-16-10 MLP trained on MNIST (training/train.py), int8 weights
// with one scale per layer. Everything the figure shows comes from forward() and imageOf().
// Pure TypeScript, no DOM, so Node tests import it directly.

export interface LayerJson {
  in: number;
  out: number;
  scale: number;
  w: string;
  b: number[];
}
export interface WeightsJson {
  sizes: number[];
  params: number;
  testAccuracy: number;
  testCount: number;
  layers: LayerJson[];
}
export interface Layer {
  in: number;
  out: number;
  w: Float32Array; // row-major [in][out]
  b: Float32Array;
}
export interface Pass {
  input: Float32Array; // 784, 0..1
  h1: Float32Array; // 16, ReLU
  h2: Float32Array; // 16, ReLU
  logits: Float32Array; // 10
  probs: Float32Array; // 10, softmax
  digit: number;
}

function bytesOf(base64: string): Int8Array {
  const text = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const out = new Int8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = (text.charCodeAt(i) << 24) >> 24;
  return out;
}

export function layersOf(json: WeightsJson): Layer[] {
  return json.layers.map((layer) => {
    const q = bytesOf(layer.w);
    const w = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) w[i] = Math.fround(q[i] * Math.fround(layer.scale));
    return { in: layer.in, out: layer.out, w, b: Float32Array.from(layer.b) };
  });
}

function dense(layer: Layer, x: Float32Array, relu: boolean) {
  const out = Float32Array.from(layer.b);
  for (let i = 0; i < layer.in; i++) {
    const v = x[i];
    if (v === 0) continue;
    const row = i * layer.out;
    for (let j = 0; j < layer.out; j++) out[j] += v * layer.w[row + j];
  }
  if (relu) for (let j = 0; j < out.length; j++) out[j] = Math.max(0, out[j]);
  return out;
}

export function forward(layers: Layer[], input: Float32Array): Pass {
  const h1 = dense(layers[0], input, true);
  const h2 = dense(layers[1], h1, true);
  const logits = dense(layers[2], h2, false);
  const top = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - top));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);
  let digit = 0;
  for (let j = 1; j < 10; j++) if (logits[j] > logits[digit]) digit = j;
  return { input, h1, h2, logits, probs, digit };
}

// ---- From pen strokes to a 28 × 28 MNIST-style image -------------------------------------
// MNIST digits were scaled so the ink fits a 20 × 20 box (aspect kept), then placed in a 28 × 28
// field with their centre of mass at the centre. The pen here is drawn at a fixed width in
// output pixels, so a digit reads the same however large it was written.

export type Stroke = Array<[number, number]>; // points in any consistent unit (pad pixels)

export const PEN = 1.15; // pen radius in output pixels
const FIELD = 28;
const BOX = 20;

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return Math.sqrt(x * x + y * y);
}

function rasterize(strokes: Stroke[], map: (p: [number, number]) => [number, number]) {
  const image = new Float32Array(FIELD * FIELD);
  for (const stroke of strokes) {
    const pts = stroke.map(map);
    const segs = pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((p, i) => [pts[i], p]);
    for (const [a, b] of segs) {
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - PEN - 1.5));
      const x1 = Math.min(FIELD - 1, Math.ceil(Math.max(a[0], b[0]) + PEN + 1.5));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - PEN - 1.5));
      const y1 = Math.min(FIELD - 1, Math.ceil(Math.max(a[1], b[1]) + PEN + 1.5));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = distanceToSegment(x + 0.5, y + 0.5, a[0], a[1], b[0], b[1]);
          const ink = Math.max(0, Math.min(1, (PEN + 0.6 - d) / 1.2));
          const at = y * FIELD + x;
          if (ink > image[at]) image[at] = ink;
        }
      }
    }
  }
  return image;
}

export function imageOf(strokes: Stroke[]): Float32Array | null {
  const all = strokes.flat();
  if (!all.length) return null;
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const w = Math.max(...xs) - left;
  const h = Math.max(...ys) - top;
  const size = Math.max(w, h);
  if (size <= 0) return null;
  const scale = (BOX - 2 * PEN) / size;
  const first = rasterize(strokes, ([x, y]) => [FIELD / 2 + (x - left - w / 2) * scale, FIELD / 2 + (y - top - h / 2) * scale]);
  let mass = 0;
  let mx = 0;
  let my = 0;
  for (let y = 0; y < FIELD; y++) {
    for (let x = 0; x < FIELD; x++) {
      const v = first[y * FIELD + x];
      mass += v;
      mx += v * (x + 0.5);
      my += v * (y + 0.5);
    }
  }
  if (!mass) return null;
  const sx = Math.round(FIELD / 2 - mx / mass);
  const sy = Math.round(FIELD / 2 - my / mass);
  return rasterize(strokes, ([x, y]) => [FIELD / 2 + sx + (x - left - w / 2) * scale, FIELD / 2 + sy + (y - top - h / 2) * scale]);
}
