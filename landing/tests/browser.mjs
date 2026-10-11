import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { forward, imageOf, layersOf } from '../components/figures/digit-net/model.ts';
import { SAMPLES } from '../components/figures/digit-net/samples.ts';
import { FLOW, INFERENCE_INTERVAL, pathOf, routeOf, signalsOf } from '../components/figures/digit-net/network.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const json = JSON.parse(readFileSync(new URL('../components/figures/digit-net/weights.json', import.meta.url)));
const layers = layersOf(json);
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : process.platform === 'darwin' ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, hasTouch: true });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
mkdirSync('shots', { recursive: true });
const predicted = () => page.locator('.dn-predicted-digit').textContent();

async function checkInference(expected) {
  const rendered = await page.evaluate(() => ({
    pixels: [...document.querySelectorAll('.dn-pixel')].map((el) => Number(el.dataset.value)),
    nodes: [...document.querySelectorAll('.dn-node')].map((el) => [el.dataset.node, Number(el.dataset.value)]),
    wires: [...document.querySelectorAll('.dn-wire')].map((el) => [Number(el.parentElement.dataset.layer), Number(el.dataset.from), Number(el.dataset.to), Number(el.dataset.contribution)]),
    digit: document.querySelector('.dn-predicted-digit').textContent,
  }));
  assert.deepEqual(rendered.pixels, [...expected.input]);
  const values = [expected.input, expected.h1, expected.h2, expected.probs];
  for (const [id, value] of rendered.nodes) { const [layer, index] = id.split('-').map(Number); assert.equal(value, values[layer][index]); }
  assert.equal(rendered.nodes.length, 42);
  assert.equal(rendered.wires.length, 416);
  for (const [layer, from, to, contribution] of rendered.wires) assert.equal(contribution || 0, layers[layer].w[from * layers[layer].out + to] * values[layer][from] || 0);
  assert.equal(rendered.digit, String(expected.digit));
}

async function drawSeven(slow = false) {
  await page.locator('#digit-pad').scrollIntoViewIfNeeded();
  const box = await page.locator('#digit-pad').boundingBox();
  await page.locator('#digit-pad').evaluate((el) => {
    window.recordedStroke = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) el.addEventListener(type, (event) => {
      if (type === 'pointermove' && !event.buttons) return;
      const box = el.getBoundingClientRect();
      window.recordedStroke.push([(event.clientX - box.left) / box.width * 280, (event.clientY - box.top) / box.height * 280]);
    });
  });
  const points = [[.26, .16], [.76, .16], [.44, .88]];
  const transform = ([x, y]) => [box.x + x * box.width, box.y + y * box.height];
  await page.mouse.move(...transform(points[0]));
  await page.mouse.down();
  for (let i = 1; i < points.length; i++) for (let step = 1; step <= 12; step++) {
    const point = points[i - 1].map((v, axis) => v + (points[i][axis] - v) * step / 12);
    await page.mouse.move(...transform(point));
    if (slow) {
      if (i === 1 && step === 1) {
        await page.waitForTimeout(30);
        assert.ok(await page.locator('#digit-pad').evaluate((canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)), 'ink paints before the next inference');
        assert.equal(await page.locator('.dn-pad-placeholder').count(), 0, 'throttled inference does not cover fresh ink with the placeholder');
      }
      await page.waitForTimeout(80);
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(100);
  const recorded = await page.evaluate(() => window.recordedStroke);
  const expected = forward(layers, imageOf([recorded]));
  await checkInference(expected);
  return expected;
}

async function checkFlow(expected, mobile = false) {
  const signals = signalsOf(layers, expected);
  await page.waitForFunction((signals) => {
    const paths = [...document.querySelectorAll('.dn-signal-wave:last-child .dn-signal-path')];
    return paths.length === signals.length && paths.every((path, i) => Number(path.dataset.contribution) === signals[i].contribution);
  }, signals);
  const rendered = await page.locator('.dn-signal-wave').last().evaluate((wave) => [...wave.querySelectorAll('.dn-signal-path')].map((path) => ({
    layer: Number(path.dataset.layer), from: Number(path.dataset.from), to: Number(path.dataset.to), contribution: Number(path.dataset.contribution),
    d: path.getAttribute('d'), timing: { delay: path.getAnimations()[0].effect.getTiming().delay, duration: path.getAnimations()[0].effect.getTiming().duration },
  })));
  assert.equal(rendered.length, signals.length);
  rendered.forEach((signal, i) => {
    const expected = signals[i];
    assert.deepEqual(signal, { layer: expected.layer, from: expected.from, to: expected.to, contribution: expected.contribution,
      d: pathOf(routeOf(expected.layer, expected.from, expected.to, mobile)), timing: { delay: expected.layer * FLOW.leg, duration: FLOW.leg } });
  });
}

try {
  await page.goto(process.env.APP_URL || 'http://localhost:3124/');
  await page.getByRole('button', { name: 'Thử nét mẫu tiếp theo', exact: true }).waitFor();
  const design = await page.evaluate(() => {
    const title = getComputedStyle(document.querySelector('.hero-title'));
    const body = getComputedStyle(document.querySelector('.hero-lede'));
    const action = getComputedStyle(document.querySelector('.dn-text-button:not(.dn-clear)'));
    return { weight: title.fontWeight, headline: title.fontSize, body: body.fontSize, blue: action.backgroundColor, radius: action.borderRadius, curved: document.querySelector('.dn-wire').getAttribute('d').includes('C') };
  });
  assert.deepEqual(design, { weight: '600', headline: '56px', body: '17px', blue: 'rgb(0, 102, 204)', radius: '9999px', curved: true });
  const seen = new Set();
  for (let n = 0; n < 10; n++) {
    const digit = Number((await page.locator('.dn-input-note').textContent()).match(/\d/)[0]);
    seen.add(digit);
    const input = imageOf(SAMPLES[digit].map((s) => s.map(([x, y]) => [x * 2.8, y * 2.8])));
    await checkInference(forward(layers, input));
    await page.getByRole('button', { name: 'Thử nét mẫu tiếp theo', exact: true }).click();
  }
  assert.equal(seen.size, 10);
  assert.equal(await page.locator('.dn-workbench,.dn-inspector,.dn-footnote').count(), 0);
  console.log('PASS: all 10 samples show exact model input, activations, signed contributions and prediction; lower details removed');
  await page.locator('[data-node="2-8"]').click();
  const opacities = await page.locator('.dn-connections[data-layer="1"] .dn-wire').evaluateAll((els) => els.map((el) => [Number(el.dataset.to), Number(el.getAttribute('opacity'))]));
  assert.ok(opacities.every(([to, opacity]) => to === 8 ? opacity >= .12 : opacity === .025));
  await page.locator('[data-node="2-8"]').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[data-node="2-9"]').getAttribute('data-selected'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-selected="true"]').count(), 0);
  console.log('PASS: actual connection highlighting and keyboard navigation');
  await page.getByRole('button', { name: 'Xóa ↺', exact: true }).click();
  assert.equal(await predicted(), '—');
  assert.ok((await page.locator('.dn-node').evaluateAll((els) => els.map((el) => Number(el.dataset.value)))).every((v) => v === 0));
  // Observe inference cadence separately from the pen's frame-by-frame painting.
  await page.evaluate(() => {
    window.flowAudit = { maximum: 0, launches: [], lifetimes: [], updates: [] };
    const started = new WeakMap();
    window.flowObserver = new MutationObserver((records) => {
      const now = performance.now();
      for (const record of records) {
        for (const node of record.addedNodes) if (node instanceof SVGGElement && node.classList.contains('dn-signal-wave')) { started.set(node, now); window.flowAudit.launches.push(now); }
        for (const node of record.removedNodes) if (started.has(node)) window.flowAudit.lifetimes.push(now - started.get(node));
      }
      window.flowAudit.maximum = Math.max(window.flowAudit.maximum, document.querySelectorAll('.dn-signal-wave').length);
    });
    window.flowObserver.observe(document.querySelector('.dn-signal-flow'), { childList: true });
    window.inferenceObserver = new MutationObserver(() => {
      const network = document.querySelector('.dn-network');
      if (network.dataset.drawing === 'true' && network.dataset.hasInput === 'true') window.flowAudit.updates.push(performance.now());
    });
    window.inferenceObserver.observe(document.querySelector('.dn-input-grid'), { subtree: true, attributes: true, attributeFilter: ['data-value'] });
  });
  const written = await drawSeven(true);
  await checkFlow(written);
  await page.waitForFunction(() => document.querySelector('.dn-signal-flow').dataset.active === 'false');
  const audit = await page.evaluate(() => { window.flowObserver.disconnect(); window.inferenceObserver.disconnect(); return window.flowAudit; });
  assert.ok(audit.launches.length >= 2, 'continuous writing sends successive waves');
  assert.equal(audit.maximum, 1, 'waves finish before the next one starts');
  assert.ok(audit.launches.slice(1).every((time, i) => time - audit.launches[i] >= FLOW.interval - 20));
  assert.ok(audit.lifetimes.every((lifetime) => lifetime >= 3 * FLOW.leg + FLOW.settle - 30), 'fresh strokes do not restart an in-flight wave');
  assert.ok(audit.updates.length >= 2 && audit.updates.length <= 6, 'a continuous stroke refreshes inference at a reduced cadence');
  assert.ok(audit.updates.slice(1).every((time, i) => time - audit.updates[i] >= INFERENCE_INTERVAL - 35), 'inference refreshes at most twice per second while writing');
  assert.equal(await page.locator('.dn-signal-path').count(), 0, 'figure rests after the final wave');
  console.log('PASS: writing directly in the input updates real inference and output prediction');
  console.log('PASS: flow follows actual signed contributions, reaches every layer in order and completes the latest stroke without restarting');
  // Restore the initial example for screenshots.
  await page.reload();
  await page.getByRole('button', { name: 'Thử nét mẫu tiếp theo', exact: true }).waitFor();
  const seven = forward(layers, imageOf(SAMPLES[7].map((stroke) => stroke.map(([x, y]) => [x * 2.8, y * 2.8]))));
  await checkFlow(seven);
  // Sample each leg at its midpoint to verify visible direction, rather than
  // checking only that animation declarations exist.
  for (let stage = 0; stage < 3; stage++) {
    const visible = await page.locator('.dn-signal-wave').last().evaluate((wave, time) => {
      wave.getAnimations({ subtree: true }).forEach((animation) => { animation.pause(); animation.currentTime = time; });
      return [...wave.querySelectorAll('.dn-signal-path')].filter((path) => Number(getComputedStyle(path).opacity) > 0).map((path) => Number(path.dataset.layer));
    }, (stage + .5) * FLOW.leg);
    assert.ok(visible.length > 0 && visible.every((layer) => layer === stage));
  }
  await page.screenshot({ path: 'shots/neural-flow-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Xóa ↺', exact: true }).click();
  assert.equal(await page.locator('.dn-signal-wave').count(), 0, 'clear cancels every wave immediately');
  // Clearing during a stroke must also cancel the pending inference timer.
  const padBox = await page.locator('#digit-pad').boundingBox();
  await page.mouse.move(padBox.x + padBox.width * .2, padBox.y + padBox.height * .2);
  await page.mouse.down();
  await page.mouse.move(padBox.x + padBox.width * .6, padBox.y + padBox.height * .7);
  await page.getByRole('button', { name: 'Xóa ↺', exact: true }).evaluate((button) => button.click());
  await page.mouse.up();
  await page.waitForTimeout(INFERENCE_INTERVAL + 50);
  assert.equal(await predicted(), '—', 'a pending update cannot restore cleared handwriting');
  assert.equal(await page.locator('.dn-signal-wave').count(), 0);
  await page.reload();
  for (const [name, width, height] of [['desktop', 1440, 1000], ['laptop', 1366, 768], ['tablet', 834, 1000], ['phone', 640, 900], ['mobile', 390, 844], ['small-mobile', 320, 720]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} horizontal overflow`);
    assert.ok(await page.locator('.dn-input-controls').evaluate((el) => {
      const bounds = el.parentElement.getBoundingClientRect();
      return [...el.querySelectorAll('button')].every((button) => {
        const box = button.getBoundingClientRect();
        return box.left >= bounds.left - .5 && box.right <= bounds.right + .5 && box.top >= bounds.top - .5 && box.bottom <= bounds.bottom + .5;
      });
    }), `${name} input buttons fit without clipping`);
    await page.screenshot({ path: `shots/neural-live-${name}.png`, fullPage: true });
    const layout = await page.evaluate(() => {
      const left = document.querySelector('.dn-experiment').getBoundingClientRect();
      const right = document.querySelector('.dn-intro').getBoundingClientRect();
      const pad = document.querySelector('#digit-pad').getBoundingClientRect();
      return { left: { x: left.x, y: left.y, width: left.width }, right: { x: right.x, y: right.y, width: right.width }, pad: { width: pad.width, bottom: pad.bottom } };
    });
    if (width > 833) { assert.ok(layout.left.x < layout.right.x); assert.ok(Math.abs(layout.left.width / layout.right.width - 1.5) < .01); }
    else assert.ok(layout.right.y < layout.left.y);
    if (name === 'laptop') assert.ok(layout.pad.bottom <= height);
    if (width <= 640) assert.ok(layout.pad.width >= 110, 'touch writing area stays usable on narrow screens');
  }
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.waitForFunction(() => !document.querySelector('.dn-signal-wave'));
  assert.equal(await page.locator('.dn-signal-wave').count(), 0, 'reduced motion cancels active waves');
  assert.equal(await page.locator('.dn-wire').first().evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Xóa ↺', exact: true }).click();
  await page.locator('#digit-pad').scrollIntoViewIfNeeded();
  const pad = await page.locator('#digit-pad').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + pad.width * .25, y: pad.y + pad.height * .25 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pad.x + pad.width * .65, y: pad.y + pad.height * .8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => document.querySelector('.dn-predicted-digit').textContent !== '—');
  assert.equal(await page.locator('.dn-signal-wave').count(), 0, 'reduced motion still permits real inference without animation');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pad.x + 30, y: pad.y + 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await cdp.detach();
  await page.getByRole('button', { name: 'Xóa ↺', exact: true }).click();
  assert.equal(await predicted(), '—');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Thử nét mẫu tiếp theo', exact: true }).click();
  const mobileDigit = Number((await page.locator('.dn-input-note').textContent()).match(/\d/)[0]);
  await checkFlow(forward(layers, imageOf(SAMPLES[mobileDigit].map((stroke) => stroke.map(([x, y]) => [x * 2.8, y * 2.8])))), true);
  assert.deepEqual(errors, []);
  console.log('PASS: desktop 60/40, laptop, 390px/320px mobile, touch drawing/cancellation, reduced motion and no browser errors');
} finally { await browser.close(); }
