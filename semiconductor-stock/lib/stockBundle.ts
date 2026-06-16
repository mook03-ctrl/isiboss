import { buildDualBuyAnalysis } from "./indicators";
import type { ChartCandle, OhlcvBar, StockApiResponse, StockSymbol } from "./types";
import { STOCK_META } from "./types";
import { fetchBundledBars, fetchLiveBars } from "./yahoo";

function barsToResponse(symbol: StockSymbol, bars: OhlcvBar[]): StockApiResponse {
  const analysis = buildDualBuyAnalysis(bars);
  const candles: ChartCandle[] = bars.map((b) => ({
    time: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));

  return {
    symbol,
    name: STOCK_META[symbol].name,
    candles,
    analysis,
  };
}

export async function fetchStockBundleFast(
  symbol: StockSymbol
): Promise<StockApiResponse | null> {
  const bars = await fetchBundledBars(symbol);
  if (!bars) return null;
  return barsToResponse(symbol, bars);
}

export async function fetchStockBundleLive(
  symbol: StockSymbol
): Promise<StockApiResponse> {
  const bars = await fetchLiveBars(symbol);
  return barsToResponse(symbol, bars);
}

export async function fetchStockBundle(
  symbol: StockSymbol
): Promise<StockApiResponse> {
  try {
    return await fetchStockBundleLive(symbol);
  } catch (liveErr) {
    const fast = await fetchStockBundleFast(symbol);
    if (fast) return fast;
    throw liveErr;
  }
}
