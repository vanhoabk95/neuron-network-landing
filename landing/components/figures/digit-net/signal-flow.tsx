import * as React from "react";
import type { Layer, Pass } from "./model";
import { FLOW, pathOf, pointOf, routeOf, signalsOf, valuesOf } from "./network";

const SVG_NS = "http://www.w3.org/2000/svg";

export function SignalFlow({ pass, layers, mobile }: { pass: Pass | null; layers: Layer[]; mobile: boolean }) {
  const root = React.useRef<SVGGElement>(null);
  const latest = React.useRef(pass);
  const request = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    latest.current = pass;
    request.current();
  }, [pass]);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = true;
    let timer: number | undefined;
    let lastStarted = -Infinity;
    let lastSnapshot: Pass | null = null;
    const waves = new Set<{ group: SVGGElement; animations: Animation[]; timer: number }>();
    const allowed = () => !reduced.matches && !document.hidden && inView;
    const stop = () => {
      window.clearTimeout(timer);
      timer = undefined;
      for (const wave of waves) {
        window.clearTimeout(wave.timer);
        wave.animations.forEach((animation) => animation.cancel());
        wave.group.remove();
      }
      waves.clear();
      el.dataset.active = "false";
      lastStarted = -Infinity;
      lastSnapshot = null;
    };

    const launch = () => {
      const snapshot = latest.current;
      if (!snapshot || snapshot === lastSnapshot || !allowed()) return;
      const signals = signalsOf(layers, snapshot);
      if (!signals.length) return;
      lastStarted = performance.now();
      lastSnapshot = snapshot;
      const group = document.createElementNS(SVG_NS, "g");
      group.classList.add("dn-signal-wave");
      group.dataset.digit = String(snapshot.digit);
      const animations: Animation[] = [];
      const values = valuesOf(snapshot);
      for (const signal of signals) {
        const { layer, from, to, contribution, strength } = signal;
        const path = document.createElementNS(SVG_NS, "path");
        path.classList.add("dn-signal-path");
        path.setAttribute("d", pathOf(routeOf(layer, from, to, mobile)));
        path.setAttribute("pathLength", "100");
        path.setAttribute("stroke-width", String(1.1 + strength * 0.7));
        Object.assign(path.dataset, { layer, from, to, contribution });
        group.append(path);
        const opacity = 0.3 + strength * 0.6;
        animations.push(path.animate([
          { strokeDashoffset: 14, opacity: 0 },
          { strokeDashoffset: 7.16, opacity, offset: 0.06 },
          { strokeDashoffset: -81.76, opacity, offset: 0.84 },
          { strokeDashoffset: -100, opacity: 0 },
        ], { duration: FLOW.leg, delay: layer * FLOW.leg, easing: "linear" }));

        // Receiving a contribution and firing after ReLU are different events.
        // Only neurons with a positive activation receive the firing halo.
        if (values[layer + 1][to] > 0) {
          const [x, y] = pointOf(layer + 1, to, mobile);
          const halo = document.createElementNS(SVG_NS, "circle");
          halo.classList.add("dn-signal-node");
          halo.setAttribute("cx", String(x));
          halo.setAttribute("cy", String(y));
          halo.dataset.layer = String(layer + 1);
          halo.dataset.index = String(to);
          group.append(halo);
          animations.push(halo.animate([
            { r: "9px", opacity: 0 },
            { r: "12px", opacity: 0.65, offset: 0.2 },
            { r: "19px", opacity: 0 },
          ], { duration: FLOW.settle, delay: (layer + 1) * FLOW.leg, easing: "cubic-bezier(.2,.7,.3,1)" }));
        }
      }
      el.append(group);
      el.dataset.active = "true";
      const wave = { group, animations, timer: window.setTimeout(() => {
        animations.forEach((animation) => animation.cancel());
        group.remove();
        waves.delete(wave);
        if (!waves.size) el.dataset.active = "false";
      }, layers.length * FLOW.leg + FLOW.settle) };
      waves.add(wave);
    };

    // Coalesce fresh inference into a bounded stream. New strokes never restart
    // an in-flight wave, and the final stroke always gets its own complete wave.
    const enqueue = () => {
      if (!latest.current || !allowed()) { stop(); return; }
      if (latest.current === lastSnapshot) return;
      if (timer !== undefined) return;
      const wait = Math.max(0, FLOW.interval - (performance.now() - lastStarted));
      if (!wait) launch();
      else timer = window.setTimeout(() => { timer = undefined; launch(); }, wait);
    };
    request.current = enqueue;
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) enqueue(); else stop(); });
    if (el.ownerSVGElement) observer.observe(el.ownerSVGElement);
    document.addEventListener("visibilitychange", enqueue);
    reduced.addEventListener("change", enqueue);
    enqueue();
    return () => {
      request.current = () => {};
      observer.disconnect();
      document.removeEventListener("visibilitychange", enqueue);
      reduced.removeEventListener("change", enqueue);
      stop();
    };
  }, [layers, mobile]);

  return <g ref={root} className="dn-signal-flow" aria-hidden="true" data-active="false" />;
}
