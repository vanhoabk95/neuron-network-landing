// Hand-shaped pen paths the idle tour writes on the pad, one per digit, in a 100 × 100 box
// (y down). They are not MNIST images: the tour writes them stroke by stroke and the network
// reads them live, exactly as it reads a visitor's own writing.

import type { Stroke } from "./model";

type Pt = [number, number];

const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });

const line = (a: Pt, b: Pt, n = 8): Pt[] => Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);

const join = (...parts: Pt[][]): Stroke => parts.flatMap((part, i) => (i ? part.slice(1) : part));

export const SAMPLES: Record<number, Stroke[]> = {
  0: [arc(50, 50, 24, 36, -100, 262, 40)],
  1: [join(line([38, 26], [53, 13], 4), line([53, 13], [52, 88], 12))],
  2: [join(arc(49, 36, 22, 22, 195, 380, 18), line([70, 44], [27, 86], 10), line([27, 86], [76, 85], 8))],
  3: [join(arc(48, 32, 21, 18, 200, 450, 22), arc(48, 67, 24, 21, -90, 160, 22))],
  4: [line([60, 12], [26, 64], 10), join(line([26, 64], [78, 63], 8)), line([62, 36], [61, 90], 10)],
  5: [join(line([72, 14], [36, 15], 6), line([36, 15], [32, 46], 6), arc(48, 64, 25, 22, 215, 495, 26))],
  6: [join(arc(70, 62, 40, 50, 263, 180, 12), arc(50, 66, 22, 21, 180, 540, 30))],
  7: [join(line([26, 16], [76, 16], 8), line([76, 16], [44, 88], 12)), line([42, 52], [68, 52], 6)],
  8: [join(arc(50, 31, 18, 17, 90, 450, 26), arc(50, 67, 22, 20, -90, 270, 28))],
  9: [join(arc(48, 35, 20, 20, 0, 365, 28), line([68, 36], [62, 88], 12))],
};

export const TOUR = [3, 7, 0, 8, 2, 5, 1, 9, 4, 6];
