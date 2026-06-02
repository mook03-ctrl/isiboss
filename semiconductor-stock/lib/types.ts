export type StockSymbol = "005930.KS" | "000660.KS";

export type TradingMode = "A" | "B";

export type MarketRegimeLabel = "대세 상승장" | "횡보장" | "하락장";

export interface OhlcvBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ConditionStatus {
  id: string;
  label: string;
  met: boolean;
  detail: string;
  points: number;
}

export interface ModeScoreResult {
  mode: TradingMode;
  title: string;
  subtitle: string;
  score: number;
  statusText: string;
  conditions: ConditionStatus[];
  stopLoss: number | null;
  isBuyRecommended: boolean;
}

export interface MarketRegime {
  label: MarketRegimeLabel;
  recommendedMode: TradingMode;
  recommendationBadge: string;
  sma60SlopePct: number;
  slopeDirection: "상승" | "하락" | "횡보";
  detail: string;
}

export interface DualBuyAnalysis {
  date: string;
  close: number;
  marketRegime: MarketRegime;
  modeA: ModeScoreResult;
  modeB: ModeScoreResult;
}

export interface StockApiResponse {
  symbol: StockSymbol;
  name: string;
  candles: ChartCandle[];
  analysis: DualBuyAnalysis;
}

export const STOCK_META: Record<
  StockSymbol,
  { name: string; short: string }
> = {
  "005930.KS": { name: "삼성전자", short: "005930" },
  "000660.KS": { name: "SK하이닉스", short: "000660" },
};
