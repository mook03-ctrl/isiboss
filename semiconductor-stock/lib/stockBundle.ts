import { buildDualBuyAnalysis } from "./indicators";
import type { ChartCandle, StockApiResponse, StockSymbol } from "./types";
import { STOCK_META } from "./types";
import { fetchSixMonthDaily } from "./yahoo";

export async function fetchStockBundle(
  symbol: StockSymbol
): Promise<StockApiResponse> {
  const bars = await fetchSixMonthDaily(symbol);
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
