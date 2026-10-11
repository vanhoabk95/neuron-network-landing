import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { forward, imageOf, layersOf } from '../components/figures/digit-net/model.ts';
import { FLOW, GRAPH, MOBILE_GRAPH, pointOf, routeOf, signalsOf, valuesOf } from '../components/figures/digit-net/network.ts';
import { SAMPLES } from '../components/figures/digit-net/samples.ts';

const json = JSON.parse(readFileSync(new URL('../components/figures/digit-net/weights.json', import.meta.url)));
const layers = layersOf(json);

for (const mobile of [false, true]) {
  test(`every edge connects the trained model's real nodes in ${mobile ? 'mobile' : 'desktop'} layout`, () => {
    const graph = mobile ? MOBILE_GRAPH : GRAPH;
    let count = 0;
    layers.forEach((layer, li) => {
      for (let from = 0; from < layer.in; from++) {
        for (let to = 0; to < layer.out; to++) {
          const points = routeOf(li, from, to, mobile);
          assert.deepEqual(points[0], pointOf(li, from, mobile));
          assert.deepEqual(points.at(-1), pointOf(li + 1, to, mobile));
          assert.ok(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= graph.width && y <= graph.height));
          count++;
        }
      }
    });
    assert.equal(count, 12960);
    assert.equal(json.params, count + 16 + 16 + 10);
  });
}

test('clearing the figure removes every input, hidden activation and output probability', () => {
  const values = valuesOf(null);
  assert.deepEqual(values.map((v) => v.length), [784, 16, 16, 10]);
  assert.ok(values.every((layer) => [...layer].every((v) => v === 0)));
});

test('flow follows the strongest signed contribution into each neuron for every sample', () => {
  let sawNegative = false;
  for (const strokes of Object.values(SAMPLES)) {
    const pass = forward(layers, imageOf(strokes.map((stroke) => stroke.map(([x, y]) => [x * 2.8, y * 2.8]))));
    const values = valuesOf(pass);
    const signals = signalsOf(layers, pass);
    assert.ok(signals.length > 0 && signals.length <= 42);
    for (const signal of signals) {
      const { layer, from, to, contribution, strength } = signal;
      assert.equal(contribution, layers[layer].w[from * layers[layer].out + to] * values[layer][from]);
      assert.ok(values[layer][from] > 0, 'inactive source neurons cannot transmit');
      for (let source = 0; source < layers[layer].in; source++) {
        assert.ok(Math.abs(contribution) >= Math.abs(layers[layer].w[source * layers[layer].out + to] * values[layer][source]));
      }
      assert.ok(strength > 0 && strength <= 1);
      if (contribution < 0) sawNegative = true;
    }
  }
  assert.ok(sawNegative, 'inhibitory contributions must not be hidden from the flow');
  assert.ok(FLOW.interval > layers.length * FLOW.leg + FLOW.settle, 'a complete wave settles before another starts');
});
