import * as React from "react";
import { BASE_ART, PLATE_ART, RACK_ART, RESULT_ART, WEB_ART } from "./art";
import { DIGIT_SEGMENTS } from "./geometry";
import { DigitNetLive } from "./live";
import weights from "./weights.json";
import "./digit-net.css";

// The landing-page hero: a pad to write on, and the network bench that reads it.
export function DigitNetHero({ intro }: { intro: React.ReactNode }) {
  const accuracy = `${(weights.testAccuracy * 100).toFixed(1).replace(".", ",")} %`;
  return <DigitNetLive intro={intro} base={BASE_ART} webs={WEB_ART} plate={PLATE_ART} racks={RACK_ART} result={RESULT_ART} segments={DIGIT_SEGMENTS} accuracy={accuracy} />;
}
