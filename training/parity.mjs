// Proves the browser model equals numpy, and that every tour sample is read correctly.
// node training/parity.mjs
import { readFileSync } from "node:fs";
import { forward, imageOf, layersOf } from "../landing/components/figures/digit-net/model.ts";
import { SAMPLES } from "../landing/components/figures/digit-net/samples.ts";

const here = new URL(".", import.meta.url);
const weights = JSON.parse(readFileSync(new URL("../landing/components/figures/digit-net/weights.json", here)));
const parity = JSON.parse(readFileSync(new URL("parity.json", here)));
const layers = layersOf(weights);

let same = 0;
let worst = 0;
parity.images.forEach((b64, n) => {
  const bytes = Buffer.from(b64, "base64");
  const input = Float32Array.from(bytes, (v) => v / 255);
  const pass = forward(layers, input);
  const ref = parity.logits[n];
  const refDigit = ref.indexOf(Math.max(...ref));
  if (refDigit === pass.digit) same++;
  for (let j = 0; j < 10; j++) worst = Math.max(worst, Math.abs(ref[j] - pass.logits[j]));
});
console.log(`parity: argmax ${same}/${parity.images.length} · max |Δlogit| ${worst.toExponential(2)}`);

let ok = 0;
for (const [digit, strokes] of Object.entries(SAMPLES)) {
  const image = imageOf(strokes);
  const pass = forward(layers, image);
  const ink = image.reduce((a, b) => a + b, 0);
  const good = pass.digit === Number(digit);
  if (good) ok++;
  console.log(`sample ${digit} → ${pass.digit} ${(pass.probs[pass.digit] * 100).toFixed(1)}%  ink ${ink.toFixed(1)}${good ? "" : "  ✗"}`);
  if (process.argv.includes("--show")) {
    for (let y = 0; y < 28; y++) console.log([...image.slice(y * 28, y * 28 + 28)].map((v) => " .:-=+*#%@"[Math.min(9, Math.floor(v * 10))]).join(""));
  }
}
const mnistInk = parity.images.reduce((s, b64) => s + Buffer.from(b64, "base64").reduce((a, v) => a + v / 255, 0), 0) / parity.images.length;
console.log(`samples ${ok}/10 · mean MNIST ink ${mnistInk.toFixed(1)}`);
if (same !== parity.images.length || worst > 1e-3 || ok !== 10) process.exit(1);
