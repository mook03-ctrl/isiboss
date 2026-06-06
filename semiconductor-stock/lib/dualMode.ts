import type {
  ConditionStatus,
  DualBuyAnalysis,
  MarketRegime,
  ModeScoreResult,
  OhlcvBar,
  TradingMode,
} from "./types";

export interface MacdPoint {
  MACD?: number;
  signal?: number;
  histogram?: number;
}

export interface IndicatorSnapshot {
  date: string;
  close: number;
  volume: number;
  rsi: number;
  prevRsi: number | null;
  macd: MacdPoint;
  prevMacd: MacdPoint | null;
  lowerBand: number;
  upperBand: number;
  middleBand: number;
  sma5: number;
  sma20: number;
  sma60: number;
  prevSma5: number | null;
  prevSma20: number | null;
  avgVolume20: number;
  recentLow5: number;
  sma60Now: number;
  sma60Past: number;
}

const BUY_THRESHOLD = 70;

export function scoreStatusText(score: number): string {
  if (score >= 80) return "강력 매수";
  if (score >= BUY_THRESHOLD) return "매수 권장";
  if (score >= 50) return "분할 매수 검토";
  return "관망";
}

export function computeStopLoss(close: number, recentLow5: number): number {
  const pctStop = close * 0.97;
  return Math.max(pctStop, recentLow5);
}

function isMacdGoldenCross(curr: MacdPoint, prev: MacdPoint | null): boolean {
  if (prev == null) return false;
  const prevMacd = prev.MACD ?? 0;
  const prevSignal = prev.signal ?? 0;
  const currMacd = curr.MACD ?? 0;
  const currSignal = curr.signal ?? 0;
  return prevMacd <= prevSignal && currMacd > currSignal;
}

function isSmaGoldenCross(
  sma5: number,
  sma20: number,
  prevSma5: number | null,
  prevSma20: number | null
): boolean {
  if (prevSma5 == null || prevSma20 == null) return false;
  return prevSma5 <= prevSma20 && sma5 > sma20;
}

function isNearOrBelowLowerBand(close: number, lower: number): boolean {
  if (lower <= 0) return false;
  return close <= lower * 1.02;
}

function isUpperBandWalkOrBreakout(
  close: number,
  upper: number,
  middle: number
): boolean {
  if (upper <= 0) return false;
  if (close >= upper * 0.995) return true;
  const span = upper - middle;
  if (span <= 0) return false;
  const position = (close - middle) / span;
  return position >= 0.85;
}

function isMaAligned(sma5: number, sma20: number, sma60: number): boolean {
  return sma5 > sma20 && sma20 > sma60;
}

function isRsiMaintainingOverbought(rsi: number, prevRsi: number | null): boolean {
  if (rsi >= 65) return true;
  if (prevRsi != null && prevRsi >= 65 && rsi >= 60) return true;
  return false;
}

export function computeMarketRegime(snapshot: IndicatorSnapshot): MarketRegime {
  const { sma60Now, sma60Past } = snapshot;
  let slopePct = 0;
  if (sma60Past > 0) {
    slopePct = ((sma60Now - sma60Past) / sma60Past) * 100;
  }

  let label: MarketRegime["label"];
  let recommendedMode: TradingMode;
  let recommendationBadge: string;
  let slopeDirection: MarketRegime["slopeDirection"];

  if (slopePct > 1.5) {
    label = "대세 상승장";
    recommendedMode = "B";
    recommendationBadge = "Mode B (추세 탑승) 참고 권장";
    slopeDirection = "상승";
  } else if (slopePct < -1.5) {
    label = "하락장";
    recommendedMode = "A";
    recommendationBadge = "Mode A (바닥 잡기) 참고 권장";
    slopeDirection = "하락";
  } else {
    label = "횡보장";
    recommendedMode = "A";
    recommendationBadge = "Mode A·B 병행 관찰";
    slopeDirection = "횡보";
  }

  return {
    label,
    recommendedMode,
    recommendationBadge,
    sma60SlopePct: slopePct,
    slopeDirection,
    detail: `SMA60 기울기(10거래일): ${slopePct >= 0 ? "+" : ""}${slopePct.toFixed(2)}% (${slopeDirection})`,
  };
}

export function computeModeA(snapshot: IndicatorSnapshot): ModeScoreResult {
  const rsiMet = snapshot.rsi <= 30;
  const bbMet = isNearOrBelowLowerBand(snapshot.close, snapshot.lowerBand);
  const macdMet = isMacdGoldenCross(snapshot.macd, snapshot.prevMacd);
  const smaMet = isSmaGoldenCross(
    snapshot.sma5,
    snapshot.sma20,
    snapshot.prevSma5,
    snapshot.prevSma20
  );

  const conditions: ConditionStatus[] = [
    {
      id: "a-rsi",
      label: "RSI ≤ 30 (과매도)",
      meaning: "14일 기준 매도 과열 → 단기 반등 가능성",
      met: rsiMet,
      detail: `RSI(14) = ${snapshot.rsi.toFixed(1)}`,
      points: 30,
    },
    {
      id: "a-bb",
      label: "볼린저 하단 이탈·근접",
      meaning: "가격이 통계적 저점 부근 → 저평가·되돌림 구간",
      met: bbMet,
      detail: `종가 ${fmtPrice(snapshot.close)} / 하단 ${fmtPrice(snapshot.lowerBand)}`,
      points: 30,
    },
    {
      id: "a-macd",
      label: "MACD 시그널 상향 돌파",
      meaning: "하락 모멘텀 약화, 상승 전환 신호(골든크로스)",
      met: macdMet,
      detail: `MACD ${(snapshot.macd.MACD ?? 0).toFixed(2)} / Signal ${(snapshot.macd.signal ?? 0).toFixed(2)}`,
      points: 20,
    },
    {
      id: "a-sma",
      label: "SMA 5·20 골든크로스",
      meaning: "단기 이평이 장기 이평을 상향 돌파 → 단기 반등",
      met: smaMet,
      detail: `SMA5 ${snapshot.sma5.toFixed(0)} / SMA20 ${snapshot.sma20.toFixed(0)}`,
      points: 20,
    },
  ];

  const score = sumScore(conditions);
  const isBuyRecommended = score >= BUY_THRESHOLD;

  return {
    mode: "A",
    title: "Mode A",
    subtitle: "바닥 잡기 · Mean Reversion",
    score,
    statusText: scoreStatusText(score),
    conditions,
    stopLoss: isBuyRecommended
      ? computeStopLoss(snapshot.close, snapshot.recentLow5)
      : null,
    isBuyRecommended,
  };
}

export function computeModeB(snapshot: IndicatorSnapshot): ModeScoreResult {
  const rsiMet = isRsiMaintainingOverbought(snapshot.rsi, snapshot.prevRsi);
  const bbMet = isUpperBandWalkOrBreakout(
    snapshot.close,
    snapshot.upperBand,
    snapshot.middleBand
  );
  const maMet = isMaAligned(snapshot.sma5, snapshot.sma20, snapshot.sma60);
  const volMet =
    snapshot.avgVolume20 > 0 &&
    snapshot.volume >= snapshot.avgVolume20 * 1.5;

  const conditions: ConditionStatus[] = [
    {
      id: "b-rsi",
      label: "RSI ≥ 65 (과매수 상승 유지)",
      meaning: "강한 매수세가 이어지는 추세 → 상승 지속 가능",
      met: rsiMet,
      detail: `RSI(14) = ${snapshot.rsi.toFixed(1)}${snapshot.prevRsi != null ? ` · 전일 ${snapshot.prevRsi.toFixed(1)}` : ""}`,
      points: 30,
    },
    {
      id: "b-bb",
      label: "볼린저 상단 돌파·Band Walk",
      meaning: "상단선 돌파·밴드 따라 상승 → 변동성 확대 추세",
      met: bbMet,
      detail: `종가 ${fmtPrice(snapshot.close)} / 상단 ${fmtPrice(snapshot.upperBand)}`,
      points: 30,
    },
    {
      id: "b-ma",
      label: "이동평균 정배열 (5 > 20 > 60)",
      meaning: "단·중·장기 이평 우상향 정렬 → 추세 상승 구조",
      met: maMet,
      detail: `SMA5 ${snapshot.sma5.toFixed(0)} > SMA20 ${snapshot.sma20.toFixed(0)} > SMA60 ${snapshot.sma60.toFixed(0)}`,
      points: 20,
    },
    {
      id: "b-vol",
      label: "거래량 20일 평균 대비 150%+",
      meaning: "평소보다 거래 급증 → 추세에 자금 유입 확인",
      met: volMet,
      detail: `당일 ${fmtVol(snapshot.volume)} / 20일평균 ${fmtVol(snapshot.avgVolume20)} (${snapshot.avgVolume20 > 0 ? ((snapshot.volume / snapshot.avgVolume20) * 100).toFixed(0) : 0}%)`,
      points: 20,
    },
  ];

  const score = sumScore(conditions);
  const isBuyRecommended = score >= BUY_THRESHOLD;

  return {
    mode: "B",
    title: "Mode B",
    subtitle: "추세 탑승 · Trend Following",
    score,
    statusText: scoreStatusText(score),
    conditions,
    stopLoss: isBuyRecommended
      ? computeStopLoss(snapshot.close, snapshot.recentLow5)
      : null,
    isBuyRecommended,
  };
}

export function computeDualAnalysis(
  snapshot: IndicatorSnapshot
): DualBuyAnalysis {
  const marketRegime = computeMarketRegime(snapshot);
  const modeA = computeModeA(snapshot);
  const modeB = computeModeB(snapshot);

  return {
    date: snapshot.date,
    close: snapshot.close,
    marketRegime,
    modeA,
    modeB,
  };
}

function sumScore(conditions: ConditionStatus[]): number {
  return conditions.reduce((sum, c) => sum + (c.met ? c.points : 0), 0);
}

function fmtPrice(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("ko-KR");
}

type TiLib = {
  RSI: { calculate: (o: { values: number[]; period: number }) => number[] };
  MACD: {
    calculate: (o: {
      values: number[];
      fastPeriod: number;
      slowPeriod: number;
      signalPeriod: number;
      SimpleMAOscillator: boolean;
      SimpleMASignal: boolean;
    }) => MacdPoint[];
  };
  BollingerBands: {
    calculate: (o: {
      period: number;
      values: number[];
      stdDev: number;
    }) => Array<{ lower?: number; middle?: number; upper?: number }>;
  };
  SMA: { calculate: (o: { period: number; values: number[] }) => number[] };
};

export function buildSnapshotFromBars(
  bars: OhlcvBar[],
  ti: TiLib
): IndicatorSnapshot {
  if (bars.length < 65) {
    throw new Error("듀얼 모드 분석에 필요한 일봉(60일+) 데이터가 부족합니다.");
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const lows = bars.map((b) => b.low);
  const dates = bars.map((b) => b.date);
  const lastIdx = bars.length - 1;

  const rsiSeries = ti.RSI.calculate({ values: closes, period: 14 });
  const macdSeries = ti.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const bbSeries = ti.BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
  const sma5Series = ti.SMA.calculate({ period: 5, values: closes });
  const sma20Series = ti.SMA.calculate({ period: 20, values: closes });
  const sma60Series = ti.SMA.calculate({ period: 60, values: closes });

  const rsi = rsiSeries[rsiSeries.length - 1];
  const prevRsi =
    rsiSeries.length > 1 ? rsiSeries[rsiSeries.length - 2] : null;
  const macd = macdSeries[macdSeries.length - 1];
  const prevMacd =
    macdSeries.length > 1 ? macdSeries[macdSeries.length - 2] : null;
  const bb = bbSeries[bbSeries.length - 1];
  const sma5 = sma5Series[sma5Series.length - 1];
  const sma20 = sma20Series[sma20Series.length - 1];
  const sma60 = sma60Series[sma60Series.length - 1];
  const prevSma5 =
    sma5Series.length > 1 ? sma5Series[sma5Series.length - 2] : null;
  const prevSma20 =
    sma20Series.length > 1 ? sma20Series[sma20Series.length - 2] : null;

  const sma60Now = sma60Series[sma60Series.length - 1];
  const sma60PastIdx = Math.max(0, sma60Series.length - 11);
  const sma60Past = sma60Series[sma60PastIdx];

  const volWindow = volumes.slice(-20);
  const avgVolume20 =
    volWindow.reduce((a, b) => a + b, 0) / volWindow.length;
  const recentLow5 = Math.min(...lows.slice(-5));

  if (
    rsi == null ||
    macd == null ||
    bb?.lower == null ||
    bb?.upper == null ||
    bb?.middle == null ||
    sma5 == null ||
    sma20 == null ||
    sma60 == null ||
    sma60Now == null ||
    sma60Past == null
  ) {
    throw new Error("최신 지표 값을 계산하지 못했습니다.");
  }

  return {
    date: dates[lastIdx],
    close: closes[lastIdx],
    volume: volumes[lastIdx],
    rsi,
    prevRsi,
    macd,
    prevMacd,
    lowerBand: bb.lower,
    upperBand: bb.upper,
    middleBand: bb.middle,
    sma5,
    sma20,
    sma60,
    prevSma5,
    prevSma20,
    avgVolume20,
    recentLow5,
    sma60Now,
    sma60Past,
  };
}
