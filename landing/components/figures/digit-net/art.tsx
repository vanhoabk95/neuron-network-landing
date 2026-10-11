import * as React from "react";
import { Dots, FaceText, Line, Solid } from "../../iso/react/draw";
import { BASE, RACKS, RESULT_GEO, RESULT_WIRES, SCREEN, SEGMENTS, WEBS } from "./geometry";
import { rodOf } from "./frame";
import { fieldMatrix } from "./view";

export const BASE_ART = (
  <g key="base">
    <path className="iso-halo" d={BASE.halo} />
    {BASE.feet.map((parts, index) => (
      <g key={index}>
        <Solid paths={parts[0]} tone="lo" crease="faint" />
        <Solid paths={parts[1]} tone="mid" crease="faint" />
      </g>
    ))}
    <Solid paths={BASE.slab} tone="mid" crease="faint" inner={<Line d={BASE.seam} tone="faint" />} />
    <Line d={BASE.groove} tone="lo" />
    <Line d={BASE.screwRings} tone="lo" />
    <Dots points={BASE.screws} size={0.5} tone="mid" />
    <Solid paths={BASE.ruler} tone="lo" crease="none" />
    <Line d={BASE.rulerMinor} tone="lo" />
    <Line d={BASE.rulerMajor} tone="mid" />
    <Solid paths={BASE.label} tone="lo" crease="none" />
    <Line d={BASE.labelLine} tone="faint" />
    <Line d={BASE.labelRules} tone="lo" free />
    <Dots points={BASE.labelScrews} size={0.45} tone="mid" />
  </g>
);

// Every wire, faint, plus one ink copy per wire whose opacity the live code sets.
export const WEB_ART = (
  <g key="webs">
    {WEBS.map((web) => (
      <g key={web.key} className="dn-web" data-web={web.key}>
        <path className="iso-line dn-rest" data-tone="faint" d={web.all} />
        {web.wires.map((wire, index) => (
          <path key={index} className="dn-wire" data-from={wire.from} data-to={wire.to} d={wire.d} />
        ))}
        {web.wires.map((wire, index) => (
          <path key={`s${index}`} className="dn-spark" d={wire.d} pathLength={100} />
        ))}
      </g>
    ))}
    <g className="dn-web" data-web="res">
      <path className="iso-line dn-rest" data-tone="faint" d={RESULT_WIRES.map((w) => w.d).join("")} />
      {RESULT_WIRES.map((wire, index) => (
        <path key={index} className="dn-wire" data-from={wire.from} data-to={wire.to} d={wire.d} />
      ))}
      {RESULT_WIRES.map((wire, index) => (
        <path key={`s${index}`} className="dn-spark" d={wire.d} pathLength={100} />
      ))}
    </g>
  </g>
);

const f = (n: number) => Math.round(n * 10) / 10;

// The result display: its segments and bars are plain paths the live code switches and stretches.
export const RESULT_ART = (
  <g key="result">
    <path className="iso-halo" d={RESULT_GEO.halo} />
    <Solid paths={RESULT_GEO.plinth} tone="mid" crease="faint" inner={<Line d={RESULT_GEO.plinthSeam} tone="faint" />} />
    <Dots points={RESULT_GEO.plinthScrews} size={0.5} tone="mid" />
    {RESULT_GEO.terminals.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Dots points={RESULT_GEO.terminalHeads} size={0.4} tone="hi" />
    <Solid paths={RESULT_GEO.panel} tone="mid" crease="faint" inner={<Line d={RESULT_GEO.panelSeam} tone="faint" />} />
    <Line d={RESULT_GEO.windowLine} tone="lo" />
    <path className="dn-window" d={RESULT_GEO.window} />
    <g className="dn-segments">
      {Object.entries(SEGMENTS).map(([name, d]) => (
        <path key={name} className="dn-seg" data-seg={name} d={d} />
      ))}
    </g>
    <Line d={RESULT_GEO.ticks} tone="lo" />
    <g className="dn-bars">
      {RESULT_GEO.bars.map((bar, index) => (
        <path
          key={index}
          className="dn-bar"
          data-bar={index}
          data-base={`${f(bar.base[0])} ${f(bar.base[1])}`}
          data-top={`${f(bar.top[0])} ${f(bar.top[1])}`}
          d={`M${f(bar.base[0])} ${f(bar.base[1])}L${f(bar.base[0])} ${f(bar.base[1])}`}
        />
      ))}
    </g>
    <Line d={RESULT_GEO.barRule} tone="mid" />
    <path className="iso-line" data-tone="mid" d={RESULT_GEO.window} />
    <Dots points={RESULT_GEO.faceScrews} size={0.5} tone="mid" />
    {RESULT_GEO.feet.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Dots points={RESULT_GEO.footScrews} size={0.45} tone="mid" />
  </g>
);

export const PLATE_ART = (
  <g key="screen">
    <path className="iso-halo" d={SCREEN.halo} />
    <Solid paths={SCREEN.plinth} tone="mid" crease="faint" inner={<Line d={SCREEN.plinthSeam} tone="faint" />} />
    <Dots points={SCREEN.plinthScrews} size={0.5} tone="mid" />
    <Solid paths={SCREEN.panel} tone="mid" crease="faint" inner={<Line d={SCREEN.panelSeam} tone="faint" />} />
    <Line d={SCREEN.bezel} tone="lo" />
    <g className="dn-field" transform={fieldMatrix()}>
      <rect className="dn-field-ground" x={0} y={0} width={28} height={28} />
    </g>
    <Line d={SCREEN.grid} tone="faint" />
    <g className="dn-field" transform={fieldMatrix()}>
      <image className="dn-field-image" data-field="" x={0} y={0} width={28} height={28} preserveAspectRatio="none" href="data:," />
    </g>
    <Line d={SCREEN.fieldEdge} tone="mid" />
    <Line d={SCREEN.ticksMinor} tone="lo" />
    <Line d={SCREEN.ticksMajor} tone="mid" />
    <Dots points={SCREEN.faceScrews} size={0.55} tone="mid" />
    {SCREEN.feet.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Dots points={SCREEN.footScrews} size={0.5} tone="mid" />
    {SCREEN.terminals.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="none" />
    ))}
    <Dots points={SCREEN.terminalHeads} size={0.4} tone="hi" />
  </g>
);

export interface NodeArt {
  key: string;
  layer: "h1" | "h2" | "out";
  index: number;
  x: number;
  y: number;
  socket: React.ReactNode;
  knob: React.ReactNode;
  rod: { fill: string; side: string; outline: string };
  puck: React.ReactNode;
}
export interface RackArt {
  key: string;
  rail: React.ReactNode;
  nodes: NodeArt[];
  front: React.ReactNode;
}

export const RACK_ART: RackArt[] = RACKS.map((rack) => ({
  key: rack.key,
  rail: (
    <g key={`${rack.key}-rail`}>
      <Solid paths={rack.stops[0]} tone="mid" crease="faint" />
      <Dots points={[rack.stopScrews[0]]} size={0.45} tone="mid" />
      <Solid paths={rack.rail} tone="mid" crease="faint" inner={<Line d={rack.railSeam} tone="faint" />} />
      <Dots points={rack.nodes.map((n) => n.jack)} size={0.42} tone="mid" />
      {rack.labels?.map((label) => (
        <FaceText key={label.digit} transform={label.transform} size={5.2} tone="mid" anchor="start">
          {String(label.digit)}
        </FaceText>
      ))}
    </g>
  ),
  nodes: rack.nodes.map((n) => ({
    key: `${rack.key}-${n.index}`,
    layer: rack.key,
    index: n.index,
    x: n.x,
    y: n.y,
    knob: (
      <g key="knob">
        <Solid paths={n.knob} tone="mid" crease="faint" inner={<Line d={n.knobKnurl} tone="lo" />} />
        <Line d={n.knobPointer} tone="hi" />
        <Dots points={[n.knobHub]} size={0.3} tone="hi" />
      </g>
    ),
    socket: (
      <g key="socket">
        <Solid paths={n.socket} tone="lo" crease="faint" />
        <Line d={n.socketRing} tone="lo" />
      </g>
    ),
    rod: rodOf(n.x, n.y, 0),
    puck: (
      <g key="puck">
        <Solid paths={n.puck} tone="hi" crease="lo" />
        <path className="dn-glow" d={n.puckTop} />
        <Line d={n.puckRing} tone="faint" />
        <Dots points={[n.hub]} size={0.45} tone="hi" />
      </g>
    ),
  })),
  front: (
    <g key={`${rack.key}-stops`}>
      <Solid paths={rack.stops[1]} tone="mid" crease="faint" />
      <Dots points={[rack.stopScrews[1]]} size={0.45} tone="mid" />
    </g>
  ),
}));
