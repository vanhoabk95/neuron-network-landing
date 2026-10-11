// The only paths rebuilt per frame: the piston rod under each puck, whose length is the lift.

import { cylinder } from "../../iso/iso-kit";
import { P, PUCK_REST, ROD_FROM } from "./view";

export const ROD_R = 0.75;

export function rodOf(x: number, y: number, liftZ: number) {
  const paths = cylinder(x, y, ROD_R, ROD_FROM - 0.2, PUCK_REST - ROD_FROM + 0.4 + liftZ, P, 12);
  return { fill: paths.fill, side: paths.shades.join(""), outline: paths.outline };
}
