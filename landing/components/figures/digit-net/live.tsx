"use client";

import * as React from "react";
import { forward, imageOf, layersOf, type Pass, type Stroke, type WeightsJson } from "./model";
import { COUNTS, GRAPH, INFERENCE_INTERVAL, MOBILE_GRAPH, X, pathOf, pointOf, routeOf, valuesOf, type Selection } from "./network";
import { SAMPLES, TOUR } from "./samples";
import { SignalFlow } from "./signal-flow";
import weightsJson from "./weights.json";

const LAYERS = layersOf(weightsJson as WeightsJson);
const PAD = 280;
const EMPTY = valuesOf(null);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const decimal = (v: number, digits = 3) => v.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (v: number) => `${decimal(v * 100, 1)} %`;
const sampleOf = (digit: number): Stroke[] => SAMPLES[digit].map((s) => s.map(([x, y]) => [x * PAD / 100, y * PAD / 100]));
const passOf = (strokes: Stroke[]) => { const image = imageOf(strokes); return image ? forward(LAYERS, image) : null; };
const INITIAL = sampleOf(7);
const INITIAL_PASS = passOf(INITIAL);

// Every path is a real weight in the loaded model, including all 12,544 input edges.
const EDGES = [false, true].map((mobile) => LAYERS.map((layer, li) => Array.from({ length: layer.in * layer.out }, (_, i) => {
  const from = Math.floor(i / layer.out);
  const to = i % layer.out;
  const route = routeOf(li, from, to, mobile);
  return { from, to, weight: layer.w[i], route, d: li ? pathOf(route) : "" };
})));

function Network({ pass, selection, select, drawing, input, controls, sample }: { pass: Pass | null; selection: Selection | null; select: (s: Selection | null) => void; drawing: boolean; input: React.ReactNode; controls: React.ReactNode; sample: number | null }) {
  const focused = selection !== null;
  const [mobile, setMobile] = React.useState(false);
  const graph = mobile ? MOBILE_GRAPH : GRAPH;
  const edgesByLayer = EDGES[mobile ? 1 : 0];
  const inputBox = mobile ? { x: 240, y: 105, width: 320, height: 320 } : { x: 29, y: 185, width: 148, height: 148 };
  const note = mobile ? { x: 400, y: 94 } : { x: 104, y: 355 };
  const controlsY = mobile ? 180 : 366;
  const answer = mobile ? { x: 350, y: 1070 } : { x: 678, y: 425 };
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const redraw = React.useRef<() => void>(() => {});
  const values = pass ? valuesOf(pass) : EMPTY;
  const maxima = values.map((v) => Math.max(...v, 0.001));

  React.useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(el.clientWidth * ratio);
      el.height = Math.round(el.clientHeight * ratio);
      ctx.setTransform(el.width / graph.width, 0, 0, el.height / graph.height, 0, 0);
      ctx.clearRect(0, 0, graph.width, graph.height);
      ctx.strokeStyle = getComputedStyle(el).getPropertyValue("--ink").trim();
      let largest = 0.001;
      for (const edge of edgesByLayer[0]) largest = Math.max(largest, Math.abs(edge.weight * (pass?.input[edge.from] ?? 0)));
      for (const edge of edgesByLayer[0]) {
        const active = Math.abs(edge.weight * (pass?.input[edge.from] ?? 0)) / largest;
        const related = selection?.layer === 1 && selection?.index === edge.to;
        ctx.globalAlpha = focused ? (related ? 0.025 + active * 0.85 : 0.002) : 0.007 + active * 0.13;
        ctx.lineWidth = related && focused ? 0.8 : 0.45;
        ctx.setLineDash(edge.weight < 0 ? [2, 3] : []);
        ctx.beginPath();
        const [start, first, second, end] = edge.route;
        ctx.moveTo(...start);
        ctx.bezierCurveTo(...first, ...second, ...end);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    redraw.current = draw;
    draw();
  }, [pass, selection, focused, edgesByLayer, graph]);

  React.useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(() => redraw.current());
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);

  function onNodeKey(event: React.KeyboardEvent<SVGGElement>, layer: number, index: number) {
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); select(selection?.layer === layer && selection.index === index ? null : { layer, index }); }
    if (event.key === "Escape") select(null);
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const nextLayer = Math.max(1, Math.min(3, layer + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0)));
      const nextIndex = (Math.min(index, COUNTS[nextLayer] - 1) + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0) + COUNTS[nextLayer]) % COUNTS[nextLayer];
      select({ layer: nextLayer, index: nextIndex });
      event.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-node="${nextLayer}-${nextIndex}"]`)?.focus();
    }
  }

  return <div className="dn-network" data-has-input={Boolean(pass)} data-drawing={drawing} style={{ aspectRatio: `${graph.width}/${graph.height}` }}>
    <canvas ref={canvas} className="dn-input-wires" aria-hidden="true" data-connections={edgesByLayer[0].length} />
    <svg viewBox={`0 0 ${graph.width} ${graph.height}`} className="dn-svg" role="group" aria-label="Mạng thật: 784 điểm ảnh, 16 nơ-ron lớp 1, 16 nơ-ron lớp 2, 10 đầu ra. Chọn nơ-ron để làm nổi bật dây nối thật. Viết trực tiếp vào ô đầu vào.">
      {edgesByLayer.slice(1).map((edges, k) => {
        const layer = k + 1;
        const source = values[layer];
        const largest = Math.max(...edges.map((e) => Math.abs(e.weight * source[e.from])), 0.001);
        return <g key={layer} className="dn-connections" data-layer={layer}>
          {edges.map((edge) => {
            const contribution = edge.weight * source[edge.from];
            const intensity = Math.abs(contribution) / largest;
            const related = (selection?.layer === layer && selection?.index === edge.from) || (selection?.layer === layer + 1 && selection?.index === edge.to);
            return <path key={`${edge.from}-${edge.to}`} d={edge.d} className="dn-wire" data-from={edge.from} data-to={edge.to} data-weight={edge.weight} data-contribution={contribution} data-negative={edge.weight < 0} strokeWidth={0.45 + intensity * 0.9} opacity={focused ? related ? 0.12 + intensity * 0.88 : 0.025 : 0.045 + intensity * 0.65} />;
          })}
        </g>;
      })}
      <SignalFlow pass={pass} layers={LAYERS} mobile={mobile} />
      <g className="dn-layer-headings" aria-hidden="true">
        {["ĐẦU VÀO", "LỚP ẨN 01", "LỚP ẨN 02", "ĐẦU RA"].map((label, layer) => {
          const x = mobile ? 400 : layer ? X[layer] : 104;
          const y = mobile ? [34, 530, 730, 920][layer] : 34;
          return <g key={label}>
            {mobile && layer > 0 && <rect x={x - 120} y={y - 20} width="240" height="50" rx="5" />}
            <text x={x} y={y} textAnchor="middle">{label}</text>
            <text className="dn-layer-count" x={x} y={y + 24} textAnchor="middle">{["28 × 28 · Viết tại đây", "16 nơ-ron", "16 nơ-ron", "0 — 9"][layer]}</text>
          </g>;
        })}
      </g>
      <rect className="dn-pixel-paper" {...inputBox} rx="18" />
      <g className="dn-input-grid" aria-label="784 điểm ảnh thực sự truyền vào mô hình" data-input-grid="true">
        {Array.from({ length: 784 }, (_, i) => {
          const [x, y] = pointOf(0, i, mobile);
          return <rect key={i} x={x - (mobile ? 4 : 1.65)} y={y - (mobile ? 4 : 1.65)} width={mobile ? 8 : 3.3} height={mobile ? 8 : 3.3} rx="0.5" className="dn-pixel" opacity={0.05 + values[0][i] * 0.95} data-value={values[0][i]} />;
        })}
      </g>
      <foreignObject {...inputBox} className="dn-input-pad">{input}</foreignObject>
      <text className="dn-input-note" x={note.x} y={note.y} textAnchor="middle">{drawing ? "Đang đọc nét viết…" : sample !== null ? `Nét mẫu · ${sample}` : pass ? "Nét viết của bạn" : "Viết số tại đây"}</text>
      <foreignObject x={mobile ? 600 : inputBox.x - 16} y={controlsY} width="180" height={mobile ? 200 : 52}>{controls}</foreignObject>
      {[1, 2, 3].map((layer) => <g key={layer} data-neuron-layer={layer}>
        {Array.from({ length: COUNTS[layer] }, (_, index) => {
          const [x, y] = pointOf(layer, index, mobile);
          const value = values[layer][index];
          const intensity = clamp(value / maxima[layer]);
          const selected = selection?.layer === layer && selection?.index === index;
          const winner = layer === 3 && pass?.digit === index;
          return <g key={index} className="dn-node" data-node={`${layer}-${index}`} data-value={value} data-selected={selected} data-winner={winner} role="button" tabIndex={selected || (!selection && layer === 1 && index === 0) ? 0 : -1} aria-pressed={selected} aria-label={`${layer === 3 ? `Chữ số ${index}, xác suất ${percent(value)}` : `Lớp ${layer}, nơ-ron ${index + 1}, kích hoạt ${decimal(value)}`}. Enter để làm nổi bật dây nối, phím mũi tên để di chuyển, Esc để xem toàn mạng.`} onClick={() => select(selected ? null : { layer, index })} onKeyDown={(e) => onNodeKey(e, layer, index)}>
            <title>{layer === 3 ? `Số ${index}: ${percent(value)}` : `Lớp ${layer} · nơ-ron ${index + 1}: ${decimal(value, 5)}`}</title>
            <circle cx={x} cy={y} r="12" fill="transparent" />
            <circle className="dn-node-shell" cx={x} cy={y} r="8.5" />
            <circle className="dn-node-ring" cx={x} cy={y} r="11" />
            <circle className="dn-node-dot" cx={x} cy={y} r={2.5 + intensity * 3.5} opacity={0.2 + intensity * 0.8} />
            {layer === 3 && <g aria-hidden="true">
              <text className="dn-output-number" x={mobile ? x - 4 : x + 17} y={mobile ? y + 26 : y + 4}>{index}</text>
              <rect className="dn-prob-track" x={mobile ? x - 17 : x + 34} y={mobile ? y + 35 : y - 2} width="34" height="3" rx="1.5" />
              <rect className="dn-prob-bar" x={mobile ? x - 17 : x + 34} y={mobile ? y + 35 : y - 2} width={34 * value} height="3" rx="1.5" />
              <text className="dn-prob-label" x={mobile ? x : x + 113} y={mobile ? y + 56 : y + 3} textAnchor={mobile ? "middle" : "end"}>{pass ? `${decimal(value * 100, 1)}%` : "—"}</text>
            </g>}
          </g>;
        })}
      </g>)}
      <g className="dn-answer" data-empty={!pass} aria-label="Kết quả dự đoán">
        <text className="dn-answer-label" x={answer.x} y={answer.y}>MẠNG ĐOÁN</text>
        <text className="dn-predicted-digit" x={answer.x - 3} y={answer.y + 58}>{pass ? pass.digit : "—"}</text>
        <text className="dn-confidence" x={answer.x + (mobile ? 70 : 52)} y={answer.y + 41}>{pass ? percent(pass.probs[pass.digit]) : "—"}</text>
      </g>
    </svg>
  </div>;
}

export function DigitNetLive({ intro }: { intro: React.ReactNode }) {
  const [pass, setPass] = React.useState<Pass | null>(INITIAL_PASS);
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [sample, setSample] = React.useState<number | null>(7);
  const [drawing, setDrawing] = React.useState(false);
  const pad = React.useRef<HTMLCanvasElement>(null);
  const strokes = React.useRef<Stroke[]>(INITIAL.map((s) => s.map(([x, y]) => [x, y])));
  const pointer = React.useRef<number | null>(null);
  const frame = React.useRef<number | null>(null);
  const inferenceTimer = React.useRef<number | null>(null);
  const lastInference = React.useRef(-Infinity);
  const tour = React.useRef(1);

  const paint = React.useCallback(() => {
    const canvas = pad.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = canvas.width / PAD;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, PAD, PAD);
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--ink").trim();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = PAD * 0.072;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes.current) {
      ctx.beginPath();
      if (stroke.length === 1) { ctx.arc(stroke[0][0], stroke[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      stroke.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
  }, []);

  const update = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (inferenceTimer.current !== null) window.clearTimeout(inferenceTimer.current);
    inferenceTimer.current = null;
    paint();
    lastInference.current = performance.now();
    setPass(passOf(strokes.current));
  }, [paint]);

  React.useEffect(() => {
    const resize = () => {
      if (!pad.current) return;
      pad.current.width = pad.current.height = Math.round(PAD * Math.min(window.devicePixelRatio || 1, 2));
      paint();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (inferenceTimer.current !== null) window.clearTimeout(inferenceTimer.current);
    };
  }, [paint]);

  const loadSample = React.useCallback((digit: number) => {
    strokes.current = sampleOf(digit);
    setSample(digit);
    update();
  }, [update]);

  function position(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [clamp((event.clientX - rect.left) / rect.width) * PAD, clamp((event.clientY - rect.top) / rect.height) * PAD];
  }

  function onDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || pointer.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = event.pointerId;
    setDrawing(true);
    if (sample !== null) strokes.current = [];
    setSample(null);
    strokes.current.push([position(event)]);
    update();
  }

  function onMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    strokes.current[strokes.current.length - 1].push(position(event));
    // Keep the pen responsive while refreshing the model at a calmer cadence.
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; paint(); });
    if (inferenceTimer.current === null) {
      const wait = INFERENCE_INTERVAL - (performance.now() - lastInference.current);
      if (wait <= 0) update();
      else inferenceTimer.current = window.setTimeout(update, wait);
    }
  }

  function onUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return;
    if (event.type !== "pointercancel" && event.type !== "lostpointercapture") strokes.current[strokes.current.length - 1].push(position(event));
    pointer.current = null;
    setDrawing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    update();
  }

  function clear() {
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null; }
    pointer.current = null;
    strokes.current = [];
    setDrawing(false);
    setSample(null);
    update();
  }

  return <div className="dn-hero">
    <section className="dn-experiment" aria-label="Thử mạng nơ-ron nhận diện chữ số">
      <div className="dn-topline"><span><span className="dn-status-dot" />Mạng nơ-ron · trực tiếp</span><span>784 → 16 → 16 → 10</span></div>
      <Network pass={pass} selection={selection} select={setSelection} drawing={drawing} sample={sample}
        input={<div className="dn-pad-wrap">
          <canvas id="digit-pad" ref={pad} width={PAD} height={PAD} className="dn-canvas" role="img" aria-label="Đầu vào của mạng: viết trực tiếp chữ số từ 0 đến 9 bằng chuột, bút hoặc ngón tay" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp} />
          {!pass && !drawing && <span className="dn-pad-placeholder" aria-hidden="true">Viết ở đây</span>}
        </div>}
        controls={<div className="dn-input-controls">
          <button className="dn-text-button dn-clear" type="button" onClick={clear}>Xóa ↺</button>
          <button className="dn-text-button" type="button" aria-label="Thử nét mẫu tiếp theo" onClick={() => { tour.current = (tour.current + 1) % TOUR.length; loadSample(TOUR[tour.current]); }}>Thử mẫu ↗</button>
        </div>}
      />
      <span className="dn-sr-only" role="status" aria-live="polite">{pass ? `Mạng đoán số ${pass.digit}, xác suất ${percent(pass.probs[pass.digit])}` : "Bảng viết trống"}</span>
    </section>
    <div className="dn-intro">{intro}</div>
  </div>;
}
