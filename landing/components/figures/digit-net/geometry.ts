// Every static path of the bench, computed once. Moving parts are built at rest and lifted.

import * as k from "../../iso/iso-kit";
import weights from "./weights.json";
import type { Flat, Plan, Point3, SolidPaths } from "../../iso/iso-kit";
import {
  ACROSS,
  AZIMUTH,
  CELL,
  COLUMNS,
  DECK,
  DECK_H,
  FIELD_HALF,
  FIELD_Z,
  FOOT_H,
  NORMAL,
  P,
  PANEL,
  PANEL_AXES,
  PLINTH,
  RESULT,
  onResult,
  onResultBase,
  onResultFace,
  resultS,
  PUCK_H,
  PUCK_REST,
  RAIL_H,
  RAIL_W,
  SOCKET_H,
  SOCKET_Z,
  WIRE_Z,
  at,
  inX,
  onFace,
  onLeaned,
  onPanel,
  outX,
  railOf,
  terminalS,
  yOf,
  type Column,
} from "./view";

const byDepth = <T>(items: T[], point: (item: T) => Point3) => [...items].sort((a, b) => k.depthOf(point(a), P) - k.depthOf(point(b), P));

// ---- Base -----------------------------------------------------------------------------------
const FEET: k.Plane[] = byDepth(
  [...k.corners(DECK, 22), [DECK.x + DECK.w / 2, DECK.y + 22] as k.Plane, [DECK.x + DECK.w / 2, DECK.y + DECK.d - 22] as k.Plane],
  ([x, y]) => [x, y, 0],
);
const RULER: Plan = { x: DECK.x + 70, y: DECK.y + DECK.d - 14, w: DECK.w - 236, d: 7, r: 1 };
const LABEL: Plan = { x: DECK.x + 14, y: DECK.y + DECK.d - 19, w: 46, d: 12, r: 1.5 };
const rulerTicks = k.topTicks(RULER.x + 4, RULER.x + RULER.w - 4, 4, 5, RULER.y + 0.6, 0.6, [2, 3.6], P);

export const BASE = {
  halo: k.haloOf(DECK, -DECK_H - FOOT_H, DECK_H, P),
  feet: FEET.map(([x, y]) => [k.cylinder(x, y, 7, -DECK_H - FOOT_H, 1.6, P, 28), k.cylinder(x, y, 5.4, -DECK_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28)]),
  slab: k.slabOf(DECK, -DECK_H, DECK_H, P, 10, 1.6),
  seam: k.sideSeam(DECK, -DECK_H / 2, P, 10),
  groove: k.planOutline(k.insetPlan(DECK, 5), 0, P, 10),
  screwRings: k.corners(DECK, 11).map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""),
  screws: k.corners(DECK, 11).map(([x, y]) => at([x, y, 0])),
  ruler: k.slabOf(RULER, 0, 0.6, P, 3),
  rulerMinor: rulerTicks.minor,
  rulerMajor: rulerTicks.major,
  label: k.slabOf(LABEL, 0, 0.8, P, 4),
  labelLine: k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 4),
  labelRules: [
    k.lineOnTop([LABEL.x + 5, LABEL.y + 4], [LABEL.x + 34, LABEL.y + 4], 0.8, P),
    k.lineOnTop([LABEL.x + 5, LABEL.y + 6.2], [LABEL.x + 26, LABEL.y + 6.2], 0.8, P),
    k.lineOnTop([LABEL.x + 5, LABEL.y + 8.4], [LABEL.x + 30, LABEL.y + 8.4], 0.8, P),
  ].join(""),
  labelScrews: [at([LABEL.x + 2.6, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d / 2, 0.8])],
};

// ---- Wires on the deck ------------------------------------------------------------------------
export interface WireGeo {
  d: string;
  from: number;
  to: number;
}
export interface Web {
  key: "h1" | "h2" | "out";
  wires: WireGeo[];
  all: string;
}

const H1 = COLUMNS[0];
const wire = (x0: number, y0: number, x1: number, y1: number) => k.pathOf([at([x0, y0, WIRE_Z]), at([x1, y1, WIRE_Z])]);

function webOf(from: Column | null, to: Column): Web {
  const wires: WireGeo[] = [];
  if (!from) {
    for (let j = 0; j < to.count; j++) {
      const [x0, y0] = onPanel(terminalS(j), PLINTH.front - 1, 0);
      wires.push({ d: wire(x0, y0, inX(to) + 1, yOf(to, j)), from: j, to: j });
    }
  } else {
    for (let i = 0; i < from.count; i++) {
      for (let j = 0; j < to.count; j++) wires.push({ d: wire(outX(from) - 1, yOf(from, i), inX(to) + 1, yOf(to, j)), from: i, to: j });
    }
  }
  return { key: to.key, wires, all: wires.map((w) => w.d).join("") };
}

export const WEBS: Web[] = [webOf(null, COLUMNS[0]), webOf(COLUMNS[0], COLUMNS[1]), webOf(COLUMNS[1], COLUMNS[2])];

// Ten wires from the output rack to the back of the result display's plinth, one per digit.
export const RESULT_WIRES: WireGeo[] = Array.from({ length: 10 }, (_, i) => {
  const [x1, y1] = onResultBase(resultS(i), RESULT.plinth.back + 1, 0);
  return { d: wire(outX(COLUMNS[2]) - 1, yOf(COLUMNS[2], i), x1, y1), from: i, to: i };
});

// ---- Sensor screen ------------------------------------------------------------------------------
// A box in the panel's own frame: s across, n toward the viewer, both half-widths given.
const boxRing = (s0: number, s1: number, n0: number, n1: number): k.Plane[] =>
  [
    [s0, n0],
    [s1, n0],
    [s1, n1],
    [s0, n1],
  ].map(([s, n]) => {
    const [x, y] = onPanel(s, n, 0);
    return [x, y] as k.Plane;
  });
const box = (s0: number, s1: number, n0: number, n1: number, z: number, h: number, bevel = 0) => k.extrude(boxRing(s0, s1, n0, n1), z, h, P, { bevel });
const face = (s: number, z: number) => at(onFace(s, z));

// A box on any three axes, shaded like the kit's prisms: the face that looks most up is the top,
// the other visible faces fall into the four side tones by how they face the light.
function hullOf(points: Flat[]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Flat[]) => {
    const out: Flat[] = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    }
    return out;
  };
  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
}
function boxOf(centre: Point3, axes: [Point3, Point3, Point3], half: Point3): SolidPaths {
  const { sinA, cosA, sinE, cosE } = k.cameraOf(P);
  const view = [cosA * cosE, sinA * cosE, sinE];
  const light = [-sinA, cosA];
  const corner = (signs: number[]) => [0, 1, 2].map((c) => centre[c] + signs[0] * half[0] * axes[0][c] + signs[1] * half[1] * axes[1][c] + signs[2] * half[2] * axes[2][c]) as Point3;
  const faces: { n: number[]; quad: Flat[] }[] = [];
  for (const axis of [0, 1, 2]) {
    for (const sign of [1, -1]) {
      const [p, q] = [0, 1, 2].filter((a) => a !== axis);
      const quad = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) => {
        const signs = [0, 0, 0];
        signs[axis] = sign;
        signs[p] = a;
        signs[q] = b;
        return at(corner(signs));
      });
      faces.push({ n: axes[axis].map((t) => t * sign), quad });
    }
  }
  const visible = faces.filter(({ n }) => n[0] * view[0] + n[1] * view[1] + n[2] * view[2] > 1e-6);
  const top = visible.reduce<(typeof faces)[number] | null>((best, f) => (f.n[2] > 0.5 && (!best || f.n[2] > best.n[2]) ? f : best), null);
  const shades: string[][] = [[], [], [], []];
  for (const f of visible) {
    if (f === top) continue;
    const lit = (f.n[0] * light[0] + f.n[1] * light[1] + 1) / 2;
    shades[Math.max(0, Math.min(3, Math.floor(lit * 4)))].push(k.pathOf(f.quad, true));
  }
  const outline = k.pathOf(hullOf(faces.flatMap((f) => f.quad)), true);
  const topPath = top ? k.pathOf(top.quad, true) : "";
  return { fill: outline, outline, crease: topPath, top: topPath, shades: shades.map((list) => list.join("")) };
}
const PANEL_LEN = PANEL.z1 - PANEL.z0;
const faceLine = (a: [number, number], b: [number, number]) => k.pathOf([face(a[0], a[1]), face(b[0], b[1])]);

const FIELD_TOP_Z = FIELD_Z + 28 * CELL;
const grid: string[] = [];
for (let n = 7; n < 28; n += 7) {
  grid.push(faceLine([-FIELD_HALF + n * CELL, FIELD_Z], [-FIELD_HALF + n * CELL, FIELD_TOP_Z]));
  grid.push(faceLine([-FIELD_HALF, FIELD_Z + n * CELL], [FIELD_HALF, FIELD_Z + n * CELL]));
}
const ticksMinor: string[] = [];
const ticksMajor: string[] = [];
for (let c = 0; c <= 28; c++) {
  const s = -FIELD_HALF + c * CELL;
  (c % 7 ? ticksMinor : ticksMajor).push(faceLine([s, FIELD_Z], [s, FIELD_Z - (c % 7 ? 1.6 : 3)]));
}
const TERMINALS = byDepth(
  Array.from({ length: 16 }, (_, j) => terminalS(j)),
  (s) => onPanel(s, PLINTH.front - 5, 0),
);
const FOOTS = [-PANEL.half + 10, PANEL.half - 10];

export const SCREEN = {
  halo: k.extrude(boxRing(-PLINTH.half - 2, PLINTH.half + 2, PLINTH.back - 2, PLINTH.front + 2), 0, PLINTH.h, P).fill,
  plinth: box(-PLINTH.half, PLINTH.half, PLINTH.back, PLINTH.front, 0, PLINTH.h, 0.8),
  plinthSeam: k.ringSeam(boxRing(-PLINTH.half, PLINTH.half, PLINTH.back, PLINTH.front), PLINTH.h / 2, P),
  plinthScrews: [-PLINTH.half + 4, PLINTH.half - 4].flatMap((s) => [at(onPanel(s, PLINTH.back + 4, PLINTH.h)), at(onPanel(s, PLINTH.front - 4, PLINTH.h))]),
  // Two feet clamp the panel to the plinth, one each side of the field.
  feet: FOOTS.map((s) => box(s - 6, s + 6, -PANEL.thick / 2 - 4, PANEL.thick / 2 + 4, PLINTH.h, PANEL.z0 - PLINTH.h + 4, 0.4)),
  footScrews: FOOTS.map((s) => at(onPanel(s, PANEL.thick / 2 + 4, PANEL.z0 + 4))),
  panel: boxOf(onLeaned(0, 0, PANEL_LEN / 2), PANEL_AXES, [PANEL.half, PANEL.thick / 2, PANEL_LEN / 2]),
  // A bevel line across the top of the face, edge to edge.
  // A bevel line round the top of the panel: across the visible left end, then the face.
  panelSeam: k.pathOf([
    at(onLeaned(-PANEL.half, -PANEL.thick / 2, PANEL_LEN - 2.2)),
    at(onLeaned(-PANEL.half, PANEL.thick / 2, PANEL_LEN - 2.2)),
    at(onLeaned(PANEL.half, PANEL.thick / 2, PANEL_LEN - 2.2)),
  ]),
  fieldEdge: k.pathOf(
    [
      face(-FIELD_HALF, FIELD_Z),
      face(FIELD_HALF, FIELD_Z),
      face(FIELD_HALF, FIELD_TOP_Z),
      face(-FIELD_HALF, FIELD_TOP_Z),
    ],
    true,
  ),
  bezel: k.pathOf(
    [
      face(-FIELD_HALF - 3, FIELD_Z - 6),
      face(FIELD_HALF + 3, FIELD_Z - 6),
      face(FIELD_HALF + 3, FIELD_TOP_Z + 3),
      face(-FIELD_HALF - 3, FIELD_TOP_Z + 3),
    ],
    true,
  ),
  grid: grid.join(""),
  ticksMinor: ticksMinor.join(""),
  ticksMajor: ticksMajor.join(""),
  faceScrews: [
    face(-PANEL.half + 4, PANEL.z0 + 4),
    face(PANEL.half - 4, PANEL.z0 + 4),
    face(-PANEL.half + 4, PANEL.z1 - 4),
    face(PANEL.half - 4, PANEL.z1 - 4),
  ],
  terminals: TERMINALS.map((s) => {
    const [x, y] = onPanel(s, PLINTH.front - 5, 0);
    return k.cylinder(x, y, 1.6, PLINTH.h, 1.8, P, 16);
  }),
  terminalHeads: TERMINALS.map((s) => at(onPanel(s, PLINTH.front - 5, PLINTH.h + 1.8))),
  across: ACROSS,
  normal: NORMAL,
};

// ---- Racks --------------------------------------------------------------------------------------
export interface NodeGeo {
  index: number;
  x: number;
  y: number;
  r: number;
  socket: SolidPaths;
  socketRing: string;
  puck: SolidPaths;
  puckRing: string;
  puckTop: string;
  hub: Flat;
  jack: Flat;
  knob: SolidPaths;
  knobKnurl: string;
  knobPointer: string;
  knobHub: Flat;
}
export interface RackGeo {
  key: Column["key"];
  rail: SolidPaths;
  railSeam: string;
  stops: SolidPaths[];
  stopScrews: Flat[];
  nodes: NodeGeo[]; // back to front
  labels?: { digit: number; transform: string }[];
}

// Each neuron's bias is a knob beside its socket: the pointer turns up to 135° either way of
// "away from the viewer", in proportion to b over the largest |b| in its layer.
const AWAY = Math.atan2(-Math.sin((AZIMUTH * Math.PI) / 180), -Math.cos((AZIMUTH * Math.PI) / 180));

function rackOf(column: Column, layer: number): RackGeo {
  const rail = railOf(column);
  const bias = weights.layers[layer].b;
  const most = Math.max(...bias.map(Math.abs));
  const knobX = column.x + column.knob;
  const stopPlans: Plan[] = [
    { x: rail.x - 1, y: rail.y - 4, w: rail.w + 2, d: 4, r: 1 },
    { x: rail.x - 1, y: rail.y + rail.d, w: rail.w + 2, d: 4, r: 1 },
  ];
  const nodes = Array.from({ length: column.count }, (_, index) => {
    const x = column.x + column.socket;
    const y = yOf(column, index);
    const r = column.r;
    const turn = AWAY - (bias[index] / most) * ((135 * Math.PI) / 180);
    const tip: k.Plane = [knobX + Math.cos(turn) * 1.2, y + Math.sin(turn) * 1.2];
    return {
      index,
      x,
      y,
      r,
      socket: k.cylinder(x, y, r + 0.7, SOCKET_Z, SOCKET_H, P, 28),
      socketRing: k.ring(x, y, 1.3, SOCKET_Z + SOCKET_H, P, 14),
      puck: k.cylinder(x, y, r, PUCK_REST, PUCK_H, P, 32, 0.4),
      puckRing: k.ring(x, y, r * 0.62, PUCK_REST + PUCK_H, P, 28),
      puckTop: k.onTop(k.circleRing(x, y, r, 32), PUCK_REST + PUCK_H, P, true),
      hub: at([x, y, PUCK_REST + PUCK_H]),
      jack: at([outX(column), y, RAIL_H / 2]),
      knob: k.cylinder(knobX, y, 1.45, RAIL_H, 2, P, 20, 0.3),
      knobKnurl: k.knurl(knobX, y, 1.45, RAIL_H, RAIL_H + 2, 18, P, 0.3),
      knobPointer: k.lineOnTop([knobX, y], tip, RAIL_H + 2, P),
      knobHub: at([knobX, y, RAIL_H + 2]),
    };
  });
  return {
    key: column.key,
    rail: k.slabOf(rail, 0, RAIL_H, P, 3, 0.5),
    railSeam: k.sideSeam(rail, RAIL_H / 2, P, 3),
    stops: byDepth(stopPlans, (p) => [p.x, p.y, 0]).map((p) => k.slabOf(p, 0, RAIL_H + 3, P, 3, 0.4)),
    stopScrews: stopPlans.map((p) => at([p.x + p.w / 2, p.y + p.d / 2, RAIL_H + 3])),
    nodes: byDepth(nodes, (n) => [n.x, n.y, 0]),
    labels:
      column.key === "out"
        ? nodes.map((n) => ({ digit: n.index, transform: k.topMatrix([column.x + 5.2, n.y + 1.75], RAIL_H, P, "x") }))
        : undefined,
  };
}

export const RACKS = COLUMNS.map((column, layer) => rackOf(column, layer));

// ---- Result display --------------------------------------------------------------------------
const resRing = (s0: number, s1: number, n0: number, n1: number): k.Plane[] =>
  [
    [s0, n0],
    [s1, n0],
    [s1, n1],
    [s0, n1],
  ].map(([s, n]) => {
    const [x, y] = onResultBase(s, n, 0);
    return [x, y] as k.Plane;
  });
const RP = RESULT.plinth;
const rface = (s: number, h: number) => at(onResultFace(s, h));
const rquad = (pts: [number, number][]) => k.pathOf(pts.map(([s, h]) => rface(s, h)), true);

// Seven segments in a 22 × 34 cell (u right, v up), each a long hexagon.
const DIGIT = { s0: -15, h0: 36, w: 30, h: 46, t: 4.6, gap: 0.8 };
function segment(u0: number, v0: number, u1: number, v1: number) {
  const t = DIGIT.t / 2;
  const horizontal = v0 === v1;
  const a = horizontal ? [u0 + DIGIT.gap, v0] : [u0, v0 + DIGIT.gap];
  const b = horizontal ? [u1 - DIGIT.gap, v1] : [u1, v1 - DIGIT.gap];
  const pts: [number, number][] = horizontal
    ? [
        [a[0], a[1]],
        [a[0] + t, a[1] - t],
        [b[0] - t, b[1] - t],
        [b[0], b[1]],
        [b[0] - t, b[1] + t],
        [a[0] + t, a[1] + t],
      ]
    : [
        [a[0], a[1]],
        [a[0] + t, a[1] + t],
        [b[0] + t, b[1] - t],
        [b[0], b[1]],
        [b[0] - t, b[1] - t],
        [a[0] - t, a[1] + t],
      ];
  return rquad(pts.map(([u, v]) => [DIGIT.s0 + u, DIGIT.h0 + v]));
}
const { w: DW, h: DH } = DIGIT;
const m = 2;
export const SEGMENTS: Record<string, string> = {
  a: segment(m, DH - m, DW - m, DH - m),
  b: segment(DW - m, DH / 2, DW - m, DH - m),
  c: segment(DW - m, m, DW - m, DH / 2),
  d: segment(m, m, DW - m, m),
  e: segment(m, m, m, DH / 2),
  f: segment(m, DH / 2, m, DH - m),
  g: segment(m, DH / 2, DW - m, DH / 2),
};
export const DIGIT_SEGMENTS = ["abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg"];

const BAR = { gap: 5.8, base: 12, top: 30 };
const barS = (i: number) => (i - 4.5) * BAR.gap;
const RESULT_TERMINALS = byDepth(
  Array.from({ length: 10 }, (_, i) => resultS(i)),
  (s) => onResultBase(s, RP.back + 4, 0),
);
const RFEET = [-RESULT.half + 7, RESULT.half - 7];

export const RESULT_GEO = {
  halo: k.extrude(resRing(-RP.half - 2, RP.half + 2, RP.back - 2, RP.front + 2), 0, RP.h, P).fill,
  plinth: k.extrude(resRing(-RP.half, RP.half, RP.back, RP.front), 0, RP.h, P, { bevel: 0.8 }),
  plinthSeam: k.ringSeam(resRing(-RP.half, RP.half, RP.back, RP.front), RP.h / 2, P),
  plinthScrews: [-RP.half + 4, RP.half - 4].flatMap((s) => [at(onResultBase(s, RP.front - 4, RP.h))]),
  terminals: RESULT_TERMINALS.map((s) => {
    const [x, y] = onResultBase(s, RP.back + 4, 0);
    return k.cylinder(x, y, 1.5, RP.h, 1.6, P, 16);
  }),
  terminalHeads: RESULT_TERMINALS.map((s) => at(onResultBase(s, RP.back + 4, RP.h + 1.6))),
  feet: RFEET.map((s) => k.extrude(resRing(s - 5, s + 5, -RESULT.thick / 2 - 3.5, RESULT.thick / 2 + 3.5), RP.h, RESULT.z0 - RP.h + 3.5, P, { bevel: 0.4 })),
  footScrews: RFEET.map((s) => at(onResultBase(s, RESULT.thick / 2 + 3.5, RESULT.z0 + 2))),
  panel: boxOf(onResult(0, 0, RESULT.len / 2), PANEL_AXES, [RESULT.half, RESULT.thick / 2, RESULT.len / 2]),
  panelSeam: k.pathOf([
    at(onResult(-RESULT.half, -RESULT.thick / 2, RESULT.len - 2.2)),
    at(onResult(-RESULT.half, RESULT.thick / 2, RESULT.len - 2.2)),
    at(onResult(RESULT.half, RESULT.thick / 2, RESULT.len - 2.2)),
  ]),
  window: rquad([
    [-33, 6],
    [33, 6],
    [33, 87],
    [-33, 87],
  ]),
  windowLine: rquad([
    [-34.5, 4.5],
    [34.5, 4.5],
    [34.5, 88.5],
    [-34.5, 88.5],
  ]),
  // The bar strip: a rule the bars stand on, running edge to edge of the window.
  barRule: k.pathOf([rface(-33, BAR.base), rface(33, BAR.base)]),
  bars: Array.from({ length: 10 }, (_, i) => ({ base: rface(barS(i), BAR.base), top: rface(barS(i), BAR.top) })),
  ticks: Array.from({ length: 10 }, (_, i) => k.pathOf([rface(barS(i), BAR.base), rface(barS(i), BAR.base - 1.6)])).join(""),
  faceScrews: [rface(-RESULT.half + 3.5, 3), rface(RESULT.half - 3.5, 3), rface(-RESULT.half + 3.5, RESULT.len - 5), rface(RESULT.half - 3.5, RESULT.len - 5)],
};
