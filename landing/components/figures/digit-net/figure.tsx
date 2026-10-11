import * as React from "react";
import { DigitNetLive } from "./live";
import "./digit-net.css";

export function DigitNetHero({ intro }: { intro: React.ReactNode }) {
  return <DigitNetLive intro={intro} />;
}
