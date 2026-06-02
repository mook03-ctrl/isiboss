import {
  BollingerBands,
  MACD,
  RSI,
  SMA,
} from "technicalindicators";

import {
  buildSnapshotFromBars,
  computeDualAnalysis,
} from "./dualMode";
import type { DualBuyAnalysis, OhlcvBar } from "./types";

export function buildDualBuyAnalysis(bars: OhlcvBar[]): DualBuyAnalysis {
  const snapshot = buildSnapshotFromBars(bars, {
    RSI,
    MACD,
    BollingerBands,
    SMA,
  });
  return computeDualAnalysis(snapshot);
}
