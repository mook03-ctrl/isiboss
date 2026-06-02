/**
 * Yahoo Finance v8 chart API — 서버·브라우저 공용
 */
import type { OhlcvBar, StockSymbol } from "./types";
import { STOCK_META } from "./types";

interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }>;
  };
}

const CORS_PROXIES = [
  (url: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) =>
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

function chartUrl(symbol: StockSymbol): string {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?interval=1d&range=6mo"
  );
}

function toDateString(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

async function fetchChartJson(symbol: StockSymbol): Promise<{
  chart?: { result?: YahooChartResult[] };
}> {
  const direct = chartUrl(symbol);
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) {
    const res = await fetch(direct, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SemiconductorStock/1.0)",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Yahoo Finance 응답 오류 (${res.status})`);
    return res.json();
  }

  try {
    const res = await fetch(direct);
    if (res.ok) return res.json();
  } catch {
    /* CORS — proxy fallback */
  }

  let lastErr: Error | null = null;
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(direct));
      if (!res.ok) continue;
      return res.json();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("Yahoo Finance 데이터를 가져오지 못했습니다.");
}

export async function fetchSixMonthDaily(
  symbol: StockSymbol
): Promise<OhlcvBar[]> {
  const json = await fetchChartJson(symbol);
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    throw new Error(
      `${STOCK_META[symbol].name} 일봉 데이터를 가져오지 못했습니다.`
    );
  }

  const bars: OhlcvBar[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;

    bars.push({
      date: toDateString(timestamps[i]),
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }

  if (bars.length < 30) {
    throw new Error(
      `${STOCK_META[symbol].name} 일봉 데이터가 부족합니다 (${bars.length}건).`
    );
  }

  return bars;
}
