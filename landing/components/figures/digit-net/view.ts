// World layout of the network bench. Units are about 1 px of the real thing, x and y on the
// floor, z up. Data flows along +x: the sensor plate, two racks of 16 neurons, a rack of 10.

import { boxCorners, fitProjection, iso, type Flat, type Plan, type Point3 } from "../../iso/iso-kit";

export const WIDTH = 760;
export const HEIGHT = 470;
export const AZIMUTH = 60;
// Looking down at 50° opens the web of wires lying on the deck.
export const ELEVATION = 50;

export const DECK: Plan = { x: -236, y: -88, w: 494, d: 176, r: 10 };
export const DECK_H = 8;
export const FOOT_H = 5;

// Sensor screen: a 28 × 28 field of 3-unit cells on a panel turned to face the viewer and leaning
// back like an easel, so the steeper camera still reads it nearly face-on. It stands on a plinth
// whose front edge carries the 16 output terminals.
export const CELL = 3;
export const FACING = ((AZIMUTH - 10) * Math.PI) / 180;
export const NORMAL: [number, number] = [Math.cos(FACING), Math.sin(FACING)];
export const ACROSS: [number, number] = [Math.sin(FACING), -Math.cos(FACING)];
export const SCREEN_AT: [number, number] = [-184, 2];
export const PANEL = { half: 52, thick: 7, z0: 13, z1: 13 + 104, lean: (28 * Math.PI) / 180 };
const LEAN_UP: Point3 = [-Math.sin(PANEL.lean) * Math.cos(FACING), -Math.sin(PANEL.lean) * Math.sin(FACING), Math.cos(PANEL.lean)];
const LEAN_OUT: Point3 = [Math.cos(PANEL.lean) * Math.cos(FACING), Math.cos(PANEL.lean) * Math.sin(FACING), Math.sin(PANEL.lean)];
export const PANEL_AXES: [Point3, Point3, Point3] = [[Math.sin(FACING), -Math.cos(FACING), 0], LEAN_OUT, LEAN_UP];
export const FIELD_HALF = (28 * CELL) / 2;
export const FIELD_Z = PANEL.z0 + 10; // bottom of the field on the face
export const PLINTH = { half: 62, back: -10, front: 24, h: 13 };
export const TERMINAL_GAP = 7;
// A point on the panel's front face (s across, z up), or anywhere in the panel's frame (s, n).
export const onPanel = (s: number, n: number, z: number): Point3 => [
  SCREEN_AT[0] + ACROSS[0] * s + NORMAL[0] * n,
  SCREEN_AT[1] + ACROSS[1] * s + NORMAL[1] * n,
  z,
];
// A point on the leaning panel: s across, n out of its face, h up its face from the bottom edge.
export const onLeaned = (s: number, n: number, h: number): Point3 => {
  const [x, y, z] = onPanel(s, 0, PANEL.z0);
  return [x + LEAN_OUT[0] * n + LEAN_UP[0] * h, y + LEAN_OUT[1] * n + LEAN_UP[1] * h, z + LEAN_OUT[2] * n + LEAN_UP[2] * h];
};
// On the front face, with z measured as if the panel stood upright (PANEL.z0 at the bottom edge).
export const onFace = (s: number, z: number) => onLeaned(s, PANEL.thick / 2 + 0.05, z - PANEL.z0);
// Terminal j feeds neuron j of the first rack; across runs against y, so wires never cross.
export const terminalS = (j: number) => (j - 7.5) * TERMINAL_GAP;

// Result display at the end of the bench: the same leaning panel, smaller, on its own plinth.
// Its window shows the chosen digit on seven segments and the ten probabilities as bars.
export const RESULT_AT: [number, number] = [204, 34];
export const RESULT = { half: 40, thick: 6, z0: 11, len: 94, plinth: { half: 46, back: -10, front: 16, h: 11 } };
export const RESULT_GAP = 7.5;
export const resultS = (i: number) => (i - 4.5) * RESULT_GAP;
export const onResult = (s: number, n: number, h: number): Point3 => {
  const base: Point3 = [RESULT_AT[0] + ACROSS[0] * s, RESULT_AT[1] + ACROSS[1] * s, RESULT.z0];
  return [base[0] + LEAN_OUT[0] * n + LEAN_UP[0] * h, base[1] + LEAN_OUT[1] * n + LEAN_UP[1] * h, base[2] + LEAN_OUT[2] * n + LEAN_UP[2] * h];
};
export const onResultBase = (s: number, n: number, z: number): Point3 => [
  RESULT_AT[0] + ACROSS[0] * s + NORMAL[0] * n,
  RESULT_AT[1] + ACROSS[1] * s + NORMAL[1] * n,
  z,
];
export const onResultFace = (s: number, h: number) => onResult(s, RESULT.thick / 2 + 0.05, h);

export const RAIL_H = 3;
export const RAIL_W = 14;
export const SOCKET_H = 2.4;
export const SOCKET_Z = RAIL_H;
export const ROD_FROM = SOCKET_Z + SOCKET_H;
export const PUCK_H = 2.2;
export const PUCK_REST = ROD_FROM + 0.6;
export const LIFT = 13;

export interface Column {
  key: "h1" | "h2" | "out";
  x: number;
  count: number;
  gap: number;
  r: number;
  w: number; // rail width
  socket: number; // socket centre, from the rail's centre line
  knob: number; // bias knob centre, from the rail's centre line
}

// The output rail is wider: its digits are engraved on its top, clear of the wires on the deck.
export const COLUMNS: Column[] = [
  { key: "h1", x: -60, count: 16, gap: 8.4, r: 3.2, w: RAIL_W, socket: -1.6, knob: RAIL_W / 2 - 2.1 },
  { key: "h2", x: 22, count: 16, gap: 8.4, r: 3.2, w: RAIL_W, socket: -1.6, knob: RAIL_W / 2 - 2.1 },
  { key: "out", x: 106, count: 10, gap: 12.6, r: 4.3, w: 24, socket: -6, knob: 1.3 },
];

// Index 0 sits at +y, which the camera puts on the left, so every rack reads 0 → n left to right.
export const yOf = (column: Column, i: number) => ((column.count - 1) / 2 - i) * column.gap;
export const railOf = (column: Column): Plan => ({
  x: column.x - column.w / 2,
  y: yOf(column, column.count - 1) - column.gap / 2 - 3,
  w: column.w,
  d: column.gap * column.count + 6,
  r: 2,
});

// A wire leaves the right side of a rail or the strip, and lands on the left side of the next.
export const WIRE_Z = 0.3;
export const outX = (column: Column) => column.x + column.w / 2;
export const inX = (column: Column) => column.x - column.w / 2;

// Activation that lifts a puck all the way (about the 99th percentile on MNIST test).
export const FULL = { h1: 20, h2: 15, out: 1 };
// Contribution |w · a| that draws a wire at full ink.
export const WIRE_FULL = { h1: 20, h2: 10, out: 8 };

export const P = fitProjection(
  [
    ...boxCorners(DECK, -DECK_H - FOOT_H, 0),
    ...COLUMNS.flatMap((column) => boxCorners(railOf(column), 0, PUCK_REST + LIFT + PUCK_H)),
    onLeaned(-PANEL.half, PANEL.thick / 2, PANEL.z1 - PANEL.z0),
    onLeaned(PANEL.half, PANEL.thick / 2, PANEL.z1 - PANEL.z0),
    onResult(-RESULT.half, RESULT.thick / 2, RESULT.len),
    onResult(RESULT.half, RESULT.thick / 2, RESULT.len),
  ],
  WIDTH,
  HEIGHT,
  { pad: 12, azimuth: AZIMUTH, elevation: ELEVATION },
);

export const at = (point: Point3): Flat => iso(point, P);
const ORIGIN = at([0, 0, 0]);
export const EX: Flat = [at([1, 0, 0])[0] - ORIGIN[0], at([1, 0, 0])[1] - ORIGIN[1]];
export const EY: Flat = [at([0, 1, 0])[0] - ORIGIN[0], at([0, 1, 0])[1] - ORIGIN[1]];
export const EZ: Flat = [at([0, 0, 1])[0] - ORIGIN[0], at([0, 0, 1])[1] - ORIGIN[1]];

const fine = (value: number) => Math.round(value * 100) / 100;
export const lift = (z: number) => `translate(${fine(EZ[0] * z)} ${fine(EZ[1] * z)})`;

// The 28 × 28 image lies on the panel's face: column → across, row → down, one cell per pixel.
export const fieldMatrix = () => {
  const o = at(onFace(-FIELD_HALF, FIELD_Z + 28 * CELL));
  const u = at(onFace(-FIELD_HALF + 1, FIELD_Z + 28 * CELL));
  const v = at(onFace(-FIELD_HALF, FIELD_Z + 28 * CELL - 1));
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `matrix(${r((u[0] - o[0]) * CELL)} ${r((u[1] - o[1]) * CELL)} ${r((v[0] - o[0]) * CELL)} ${r((v[1] - o[1]) * CELL)} ${r(o[0])} ${r(o[1])})`;
};
