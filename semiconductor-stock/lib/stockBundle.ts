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
  symbol: StockSymbol,
  opts?: { retries?: number }
): Promise<StockApiResponse> {
  const maxAttempts = (opts?.retries ?? 1) + 1;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const bars = await fetchLiveBars(symbol);
      return barsToResponse(symbol, bars);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  throw lastErr ?? new Error("실시간 시세를 가져오지 못했습니다.");
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
