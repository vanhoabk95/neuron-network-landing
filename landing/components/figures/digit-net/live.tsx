"use client";

import * as React from "react";
import { Plate } from "../../iso/react/draw";
import { asksForStillness, spring, useInView, useLoop, useReadout, type Spring } from "../../iso/react/live";
import type { NodeArt, RackArt } from "./art";
import { rodOf } from "./frame";
import { forward, imageOf, layersOf, type Pass, type Stroke, type WeightsJson } from "./model";
import { SAMPLES, TOUR } from "./samples";
import { EZ, FULL, HEIGHT, LIFT, PUCK_H, PUCK_REST, WIDTH, WIRE_FULL, at, lift } from "./view";
import weightsJson from "./weights.json";

const LAYERS = layersOf(weightsJson as WeightsJson);
const PAD = 280;
const HOP = 0.24; // seconds for the signal to cross one web
const WRITE = 1.5; // seconds the tour takes to write a digit
const HOLD = 2.6; // seconds it shows the reading
const IDLE = 1.4;
const RESUME = 3.6;
const CLEAR = 0.45;
const PEN = PAD * 0.072;

type LayerKey = "h1" | "h2" | "out";
const KEYS: LayerKey[] = ["h1", "h2", "out"];

interface Live {
  strokes: Stroke[];
  drawing: boolean;
  dirty: boolean;
  pass: Pass | null;
  shown: Record<LayerKey, Float32Array>; // targets the pucks are released to, layer by layer
  springs: Record<LayerKey, Spring[]>;
  cascade: number; // seconds since the last pulse started, or Infinity
  template: number; // h1 neuron whose weights show on the plate, or -1
  tour: { on: boolean; digit: number; t: number; step: number; idle: number };
  touched: number; // seconds since the last interaction
  winner: number;
  said: string;
}

const zeros = (n: number) => new Float32Array(n);
const springsOf = (n: number) => Array.from({ length: n }, () => ({ at: 0, rate: 0 }));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function tokenOf(element: Element | null, name: string, fallback: string) {
  if (!element) return fallback;
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}

function rgbOf(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const m = color.match(/\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}

// The part of a stroke list the tour has written after `share` of its length.
function partOf(strokes: Stroke[], share: number): Stroke[] {
  const lengths = strokes.map((s) => s.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0));
  let budget = lengths.reduce((a, b) => a + b, 0) * share;
  const out: Stroke[] = [];
  strokes.forEach((s, n) => {
    if (budget <= 0) return;
    if (budget >= lengths[n]) {
      out.push(s);
      budget -= lengths[n];
      return;
    }
    const part: Stroke = [s[0]];
    for (let i = 1; i < s.length && budget > 0; i++) {
      const step = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (step <= budget) {
        part.push(s[i]);
        budget -= step;
      } else {
        const t = budget / step;
        part.push([s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t]);
        budget = 0;
      }
    }
    out.push(part);
  });
  return out;
}

const toPad = (strokes: Stroke[]): Stroke[] => strokes.map((s) => s.map(([x, y]) => [x * (PAD / 100), y * (PAD / 100)] as [number, number]));

export function DigitNetLive({ intro, base, webs, plate, racks, result, segments, accuracy }: { intro: React.ReactNode; base: React.ReactNode; webs: React.ReactNode; plate: React.ReactNode; racks: RackArt[]; result: React.ReactNode; segments: string[]; accuracy: string }) {
  const { anchor: stage, say } = useReadout<HTMLDivElement>();
  const svg = React.useRef<SVGSVGElement>(null);
  const pad = React.useRef<HTMLCanvasElement>(null);
  const live = React.useRef<HTMLSpanElement>(null);
  const answer = React.useRef<HTMLDivElement>(null);
  const field = React.useRef<HTMLCanvasElement | null>(null);
  const nodes = React.useRef<Record<string, { puck: SVGGElement | null; rod: SVGGElement | null }>>({});
  const wires = React.useRef<Record<LayerKey, { el: SVGPathElement; spark: SVGPathElement; from: number; to: number; w: number; alpha: number }[]>>({ h1: [], h2: [], out: [] });
  const groups = React.useRef<Record<LayerKey, SVGGElement | null>>({ h1: null, h2: null, out: null });
  const display = React.useRef<{ segs: Record<string, SVGPathElement>; bars: { el: SVGPathElement; base: number[]; top: number[]; p: number }[]; wires: { el: SVGPathElement; spark: SVGPathElement; alpha: number }[]; group: SVGGElement | null; shown: number }>({ segs: {}, bars: [], wires: [], group: null, shown: -2 });
  const visible = useInView(stage);
  const state = React.useRef<Live>({
    strokes: [],
    drawing: false,
    dirty: false,
    pass: null,
    shown: { h1: zeros(16), h2: zeros(16), out: zeros(10) },
    springs: { h1: springsOf(16), h2: springsOf(16), out: springsOf(10) },
    cascade: Infinity,
    template: -1,
    tour: { on: true, digit: 0, t: 0, step: 0, idle: IDLE },
    touched: 99,
    winner: -1,
    said: "",
  });

  // ---- Painting: the pad and the image on the plate ----------------------------------------
  const paintPad = React.useCallback(() => {
    const canvas = pad.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = canvas.width / PAD;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, PAD, PAD);
    ctx.strokeStyle = tokenOf(canvas, "--anatomy-hi", "#222");
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = PEN;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of state.current.strokes) {
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(s[0][0], s[0][1], PEN / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      for (let i = 1; i < s.length - 1; i++) {
        const mx = (s[i][0] + s[i + 1][0]) / 2;
        const my = (s[i][1] + s[i + 1][1]) / 2;
        ctx.quadraticCurveTo(s[i][0], s[i][1], mx, my);
      }
      const last = s[s.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }
  }, []);

  const paintField = React.useCallback(() => {
    const root = svg.current;
    const image = root?.querySelector<SVGImageElement>("[data-field]");
    if (!root || !image) return;
    if (!field.current) {
      field.current = document.createElement("canvas");
      field.current.width = 28;
      field.current.height = 28;
    }
    const ctx = field.current.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    const out = ctx.createImageData(28, 28);
    const ink = rgbOf(tokenOf(root, "--dn-pos", "#222"));
    const neg = rgbOf(tokenOf(root, "--dn-neg", "#c33"));
    if (s.template >= 0) {
      const layer = LAYERS[0];
      let most = 0;
      for (let i = 0; i < 784; i++) most = Math.max(most, Math.abs(layer.w[i * 16 + s.template]));
      for (let i = 0; i < 784; i++) {
        const v = layer.w[i * 16 + s.template] / most;
        const c = v >= 0 ? ink : neg;
        out.data.set([c[0], c[1], c[2], Math.round(clamp01(Math.abs(v) * 1.4) * 255)], i * 4);
      }
    } else if (s.pass) {
      for (let i = 0; i < 784; i++) out.data.set([ink[0], ink[1], ink[2], Math.round(s.pass.input[i] * 255)], i * 4);
    }
    ctx.putImageData(out, 0, 0);
    image.setAttribute("href", field.current.toDataURL());
  }, []);

  // ---- The network -----------------------------------------------------------------------
  const recompute = React.useCallback(() => {
    const s = state.current;
    const image = imageOf(s.strokes);
    s.pass = image ? forward(LAYERS, image) : null;
    s.dirty = false;
    paintField();
  }, [paintField]);

  // A spark runs along the wires that carry the most of each layer's input, one web after another.
  const pulse = React.useCallback(() => {
    const s = state.current;
    s.cascade = asksForStillness() || !s.pass ? Infinity : 0;
    const pass = s.pass;
    if (!pass) return;
    const acts = [pass.input, pass.h1, pass.h2];
    KEYS.forEach((key, n) => {
      const list = wires.current[key].map((wire) => ({ wire, c: n === 0 ? pass.h1[wire.to] : Math.abs(wire.w) * acts[n][wire.from] }));
      const top = [...list].sort((a, b) => b.c - a.c).slice(0, n === 0 ? 6 : 12);
      const most = top[0]?.c || 1;
      for (const { wire } of list) wire.spark.style.opacity = "0";
      for (const { wire, c } of top) if (c > 0) wire.spark.style.opacity = (0.35 + 0.65 * (c / most)).toFixed(2);
    });
    display.current.wires.forEach((wire, i) => (wire.spark.style.opacity = i === pass.digit ? "1" : "0"));
  }, []);

  const racksByKey = React.useMemo(() => {
    const map: Record<string, NodeArt> = {};
    for (const rack of racks) for (const node of rack.nodes) map[node.key] = node;
    return map;
  }, [racks]);

  const draw = React.useCallback(
    (dt: number, calm: boolean) => {
      const s = state.current;
      const pass = s.pass;
      const target: Record<LayerKey, ArrayLike<number>> = {
        h1: pass ? pass.h1 : zeros(16),
        h2: pass ? pass.h2 : zeros(16),
        out: pass ? pass.probs : zeros(10),
      };
      // Release each layer's targets when the signal reaches it; drawing by hand releases at once.
      if (Number.isFinite(s.cascade)) s.cascade += dt;
      const reached = (n: number) => s.drawing || calm || !Number.isFinite(s.cascade) || s.cascade >= HOP * (n + 1);
      let moving = false;
      KEYS.forEach((key, n) => {
        if (reached(n)) s.shown[key] = Float32Array.from(target[key]);
        const group = groups.current[key];
        const run = s.drawing || calm || !Number.isFinite(s.cascade) ? 1 : clamp01((s.cascade - HOP * n) / HOP);
        // The spark's head travels source → target (pathLength 100) and its tail follows it in.
        if (group) group.style.setProperty("--spark", run >= 1 ? "-120" : String(Math.round(14 - run * 114)));
        if (run < 1) moving = true;
      });
      KEYS.forEach((key) => {
        const springs = s.springs[key];
        springs.forEach((sp, i) => {
          const goal = clamp01(s.shown[key][i] / FULL[key]);
          if (!spring(sp, goal, dt, 260, 24, calm)) moving = true;
          const ref = nodes.current[`${key}-${i}`];
          if (!ref) return;
          const z = LIFT * Math.max(0, sp.at);
          ref.puck?.setAttribute("transform", lift(z));
          const glow = ref.puck?.querySelector<SVGPathElement>(".dn-glow");
          if (glow) glow.style.opacity = (0.7 * clamp01(sp.at)).toFixed(3);
          if (ref.rod) {
            const node = racksByKey[`${key}-${i}`];
            const paths = rodOf(node.x, node.y, z);
            const [fill, side, outline] = Array.from(ref.rod.children) as SVGPathElement[];
            fill.setAttribute("d", paths.fill);
            side.setAttribute("d", paths.side);
            outline.setAttribute("d", paths.outline);
          }
        });
      });
      // Wire ink: how much each wire contributes to the neuron it feeds, |w · a|.
      KEYS.forEach((key, n) => {
        const source = n === 0 ? null : s.springs[KEYS[n - 1]];
        const scale = n === 0 ? 1 : FULL[KEYS[n - 1]];
        for (const wire of wires.current[key]) {
          const alpha = n === 0 ? clamp01(s.springs.h1[wire.to].at) : clamp01((Math.abs(wire.w) * Math.max(0, source![wire.from].at) * scale) / WIRE_FULL[key]);
          if (Math.abs(alpha - wire.alpha) > 0.01 || (alpha === 0 && wire.alpha !== 0)) {
            wire.alpha = alpha;
            wire.el.style.opacity = (alpha * 0.95).toFixed(2);
          }
        }
      });
      // The winner is read from where the output pucks are, not from the target.
      const outs = s.springs.out.map((sp) => sp.at);
      let winner = -1;
      if (pass) {
        winner = 0;
        for (let i = 1; i < 10; i++) if (outs[i] > outs[winner]) winner = i;
        if (outs[winner] < 0.05) winner = -1;
      }
      if (winner !== s.winner) {
        const old = nodes.current[`out-${s.winner}`]?.puck?.querySelector(".iso-solid");
        old?.removeAttribute("data-lit");
        nodes.current[`out-${winner}`]?.puck?.querySelector(".iso-solid")?.setAttribute("data-lit", "");
        s.winner = winner;
      }
      // The result display: ten bars from the output pucks, the digit when the signal arrives.
      const d = display.current;
      d.bars.forEach((bar, i) => {
        const p = clamp01(outs[i]);
        if (Math.abs(p - bar.p) > 0.002 || (p === 0 && bar.p !== 0)) {
          bar.p = p;
          const x = bar.base[0] + (bar.top[0] - bar.base[0]) * p;
          const y = bar.base[1] + (bar.top[1] - bar.base[1]) * p;
          bar.el.setAttribute("d", `M${bar.base[0]} ${bar.base[1]}L${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        bar.el.toggleAttribute("data-win", i === winner);
      });
      d.wires.forEach((wire, i) => {
        const alpha = clamp01(outs[i]);
        if (Math.abs(alpha - wire.alpha) > 0.01 || (alpha === 0 && wire.alpha !== 0)) {
          wire.alpha = alpha;
          wire.el.style.opacity = (alpha * 0.95).toFixed(2);
        }
      });
      const run = s.drawing || calm || !Number.isFinite(s.cascade) ? 1 : clamp01((s.cascade - HOP * 3) / HOP);
      if (d.group) d.group.style.setProperty("--spark", run >= 1 ? "-120" : String(Math.round(14 - run * 114)));
      if (run < 1) moving = true;
      const lit = run >= 1 ? winner : d.shown;
      if (lit !== d.shown) {
        d.shown = lit;
        const on = lit >= 0 ? segments[lit] : "";
        for (const [name, el] of Object.entries(d.segs)) el.toggleAttribute("data-on", on.includes(name));
      }
      say(winner < 0 ? "chưa có nét nào" : `đoán ${winner} · ${Math.round(clamp01(outs[winner]) * 100)}%`);
      const card = answer.current;
      if (card) {
        const digit = lit >= 0 ? String(lit) : "–";
        const pct = winner >= 0 ? `${Math.round(clamp01(outs[winner]) * 100)}%` : "";
        const [big, small] = card.querySelectorAll("b, i");
        if (big.textContent !== digit) big.textContent = digit;
        if (small.textContent !== pct) small.textContent = pct;
        card.toggleAttribute("data-empty", lit < 0);
      }
      return moving;
    },
    [say, racksByKey, segments],
  );

  const announce = React.useCallback(() => {
    const s = state.current;
    const text = s.pass ? `Mạng đoán số ${s.pass.digit}, độ tin cậy ${Math.round(s.pass.probs[s.pass.digit] * 100)} phần trăm` : "Bàn vẽ trống";
    if (text !== s.said && live.current) {
      s.said = text;
      live.current.textContent = text;
    }
  }, []);

  // ---- Tour -------------------------------------------------------------------------------
  const tourTick = React.useCallback(
    (dt: number) => {
      const s = state.current;
      const t = s.tour;
      s.touched += dt;
      if (!t.on) {
        if (!s.drawing && !s.strokes.length && s.touched > RESUME) {
          t.on = true;
          t.t = 0;
          t.idle = IDLE;
        } else return false;
      }
      // The tour holds still while someone looks at a neuron's weights.
      if (s.template >= 0) return true;
      if (t.idle > 0) {
        t.idle -= dt;
        return true;
      }
      t.t += dt;
      const digit = TOUR[t.step % TOUR.length];
      const strokes = toPad(SAMPLES[digit]);
      if (t.t <= WRITE) {
        s.strokes = partOf(strokes, t.t / WRITE);
        s.drawing = true;
        s.dirty = true;
      } else if (s.drawing) {
        s.strokes = strokes;
        s.drawing = false;
        s.dirty = true;
        recompute();
        pulse();
        announce();
      } else if (t.t > WRITE + HOLD) {
        s.strokes = [];
        s.dirty = true;
        t.step += 1;
        t.t = 0;
        t.idle = CLEAR;
      }
      return true;
    },
    [announce, pulse, recompute],
  );

  const kick = useLoop((dt, calm) => {
    const s = state.current;
    const touring = !calm && tourTick(dt);
    if (s.dirty) {
      recompute();
      paintPad();
    }
    const moving = draw(dt, calm);
    return touring || moving || s.drawing || s.touched < RESUME + 0.1;
  }, visible);

  // ---- Wiring up the DOM ------------------------------------------------------------------
  React.useEffect(() => {
    const root = svg.current;
    if (!root) return;
    KEYS.forEach((key, n) => {
      const group = root.querySelector<SVGGElement>(`.dn-web[data-web="${key}"]`);
      groups.current[key] = group;
      const layer = LAYERS[n];
      const sparks = Array.from(group?.querySelectorAll<SVGPathElement>(".dn-spark") ?? []);
      wires.current[key] = Array.from(group?.querySelectorAll<SVGPathElement>(".dn-wire") ?? []).map((el, at) => {
        const from = Number(el.dataset.from);
        const to = Number(el.dataset.to);
        const w = n === 0 ? 1 : layer.w[from * layer.out + to];
        el.dataset.sign = w >= 0 ? "+" : "-";
        return { el, spark: sparks[at], from, to, w, alpha: 0 };
      });
    });
    const d = display.current;
    root.querySelectorAll<SVGPathElement>(".dn-seg").forEach((el) => (d.segs[el.dataset.seg!] = el));
    d.bars = Array.from(root.querySelectorAll<SVGPathElement>(".dn-bar")).map((el) => ({
      el,
      base: el.dataset.base!.split(" ").map(Number),
      top: el.dataset.top!.split(" ").map(Number),
      p: 0,
    }));
    d.group = root.querySelector<SVGGElement>('.dn-web[data-web="res"]');
    const resSparks = Array.from(d.group?.querySelectorAll<SVGPathElement>(".dn-spark") ?? []);
    d.wires = Array.from(d.group?.querySelectorAll<SVGPathElement>(".dn-wire") ?? []).map((el, i) => ({ el, spark: resSparks[i], alpha: 0 }));
    const canvas = pad.current;
    if (canvas) {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(PAD * ratio);
      canvas.height = Math.round(PAD * ratio);
    }
    if (asksForStillness()) {
      // Reduced motion: no tour; show one written digit, still and readable.
      const s = state.current;
      s.tour.on = false;
      s.touched = 0;
      s.strokes = toPad(SAMPLES[3]);
      recompute();
    }
    paintPad();
    const themes = window.matchMedia("(prefers-color-scheme: dark)");
    const repaint = () => requestAnimationFrame(() => {
      paintPad();
      paintField();
    });
    themes.addEventListener("change", repaint);
    const observer = new MutationObserver(repaint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      themes.removeEventListener("change", repaint);
      observer.disconnect();
    };
  }, [paintField, paintPad, recompute]);

  const touch = React.useCallback(() => {
    const s = state.current;
    s.touched = 0;
    if (s.tour.on) {
      s.tour.on = false;
      s.strokes = [];
      s.drawing = false;
      s.dirty = true;
    }
    kick();
  }, [kick]);

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const box = event.currentTarget.getBoundingClientRect();
    return [((event.clientX - box.left) / box.width) * PAD, ((event.clientY - box.top) / box.height) * PAD];
  };

  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touch();
    const s = state.current;
    s.drawing = true;
    s.cascade = Infinity;
    s.strokes = [...s.strokes, [pointOf(event)]];
    s.dirty = true;
  };
  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const s = state.current;
    if (!s.drawing || s.tour.on) return;
    const stroke = s.strokes[s.strokes.length - 1];
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const box = event.currentTarget.getBoundingClientRect();
    for (const e of events) {
      const p: [number, number] = [((e.clientX - box.left) / box.width) * PAD, ((e.clientY - box.top) / box.height) * PAD];
      const last = stroke[stroke.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 1.5) stroke.push(p);
    }
    s.dirty = true;
    s.touched = 0;
    kick();
  };
  const onUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const s = state.current;
    if (!s.drawing || s.tour.on) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    s.drawing = false;
    s.touched = 0;
    recompute();
    pulse();
    announce();
    kick();
  };
  const clear = () => {
    touch();
    const s = state.current;
    s.strokes = [];
    s.drawing = false;
    s.dirty = true;
    s.cascade = Infinity;
    announce();
  };

  // Hovering a neuron in the first rack shows the 784 weights it looks for on the plate.
  const showTemplate = (index: number) => {
    const s = state.current;
    if (s.template === index) return;
    nodes.current[`h1-${s.template}`]?.puck?.removeAttribute("data-pick");
    nodes.current[`h1-${index}`]?.puck?.setAttribute("data-pick", "");
    s.template = index;
    paintField();
    kick();
  };
  const onFigureMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const root = svg.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const y = ((event.clientY - box.top) / box.height) * HEIGHT;
    let best = -1;
    let bestD = 9;
    for (let i = 0; i < 16; i++) {
      const hub = hubs[i];
      const z = LIFT * Math.max(0, state.current.springs.h1[i].at) * zRise;
      const d = Math.hypot(x - hub[0], y - (hub[1] - z));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    showTemplate(best);
  };
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const s = state.current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") showTemplate((s.template + 1) % 16);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") showTemplate((s.template + 15) % 16);
    else if (event.key === "Escape") {
      if (s.template >= 0) showTemplate(-1);
      else clear();
    } else return;
    event.preventDefault();
  };

  const { hubs, zRise } = React.useMemo(() => hubsOf(racks), [racks]);

  return (
    <div className="dn-hero">
      <div className="dn-side">
        {intro}
        <div className="dn-pad">
          <canvas
            ref={pad}
            className="dn-canvas"
            width={PAD}
            height={PAD}
            role="img"
            aria-label="Bàn vẽ: dùng chuột, bút hoặc ngón tay viết một chữ số từ 0 đến 9"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <div className="dn-answer" ref={answer} data-empty="" aria-hidden="true">
            <span className="dn-answer-label">mạng đoán</span>
            <b>–</b>
            <i />
          </div>
          <div className="dn-pad-bar">
            <span className="dn-pad-note">viết một chữ số 0–9</span>
            <button type="button" className="dn-clear" onClick={clear}>
              Xoá
            </button>
          </div>
          <span className="dn-say" ref={live} aria-live="polite" />
        </div>
      </div>
      <Plate
        fig="Fig 1"
        title="Mạng nơ-ron đọc chữ số"
        hint="Viết vào bàn vẽ · trỏ vào lớp 1"
        readout="chưa có nét nào"
        keys={[
          { mark: "raised", label: "Nơ-ron: nâng càng cao, kích hoạt càng mạnh" },
          { mark: "edge", label: "Dây: đóng góp w·a, đậm khi lớn" },
          { mark: "red", label: "Trọng số âm, kìm nơ-ron sau" },
          { mark: "lit", label: "Chữ số mạng chọn" },
        ]}
        caption={`Mạng 784 → 16 → 16 → 10 với 12 730 tham số, huấn luyện trên 60 000 chữ số MNIST, đọc đúng ${accuracy} trên 10 000 chữ số chưa từng thấy. Tấm bên trái là 784 điểm ảnh 28 × 28 mà mạng thực sự nhìn thấy; mỗi nơ-ron lớp 1 cộng cả 784 điểm với trọng số riêng (trỏ vào nó để xem), hai lớp sau cộng các dây nối tới chúng, và lớp cuối chọn chữ số. Mọi con số đều do chính mô hình này tính trong trình duyệt.`}
      >
        <div ref={stage} className="iso-stage dn-stage" tabIndex={0} role="group" aria-label="Mạng nơ-ron: phím mũi tên chọn một nơ-ron lớp 1 để xem trọng số, Esc để thoát" onKeyDown={onKey} onBlur={() => showTemplate(-1)}>
          <svg
            ref={svg}
            className="iso-svg dn-svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label="Một bàn thí nghiệm: tấm cảm biến 28 × 28 điểm ảnh, hai giá 16 nơ-ron và một giá 10 nơ-ron đầu ra, nối với nhau bằng dây trên mặt bàn. Nơ-ron nâng lên khi được kích hoạt."
            focusable="false"
            onPointerMove={onFigureMove}
            onPointerDown={onFigureMove}
            onPointerLeave={() => showTemplate(-1)}
          >
            {base}
            {webs}
            {plate}
            {racks.map((rack) => (
              <g key={rack.key} data-rack={rack.key}>
                {rack.rail}
                {rack.nodes.map((node) => (
                  <g key={node.key}>
                    {node.socket}
                    <g
                      className="iso-solid dn-rod"
                      ref={(el) => {
                        (nodes.current[node.key] ??= { puck: null, rod: null }).rod = el;
                      }}
                    >
                      <path className="iso-fill" d={node.rod.fill} />
                      <path className="iso-shade" data-shade="1" d={node.rod.side} />
                      <path className="iso-line iso-edge" data-tone="mid" d={node.rod.outline} />
                    </g>
                    <g
                      ref={(el) => {
                        (nodes.current[node.key] ??= { puck: null, rod: null }).puck = el;
                      }}
                    >
                      {node.puck}
                    </g>
                    {node.knob}
                  </g>
                ))}
                {rack.front}
              </g>
            ))}
            {result}
          </svg>
        </div>
      </Plate>
    </div>
  );
}

function hubsOf(racks: RackArt[]) {
  // Screen positions of the first rack's puck tops at rest, and screen px per unit of lift.
  const first = racks[0].nodes;
  const hubs: [number, number][] = [];
  for (const node of first) hubs[node.index] = hubAt(node.x, node.y);
  return { hubs, zRise: zRiseOf() };
}

const hubAt = (x: number, y: number) => at([x, y, PUCK_REST + PUCK_H]);
const zRiseOf = () => -EZ[1];
