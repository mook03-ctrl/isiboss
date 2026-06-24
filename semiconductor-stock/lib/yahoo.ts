/**
 * Yahoo Finance v8 chart API — 즉시 baked + live 갱신
 */
import type { OhlcvBar, StockSymbol } from "./types";
import { STOCK_META } from "./types";

interface YahooChartMeta {
  regularMarketPrice?: number;
  regularMarketTime?: number;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
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

const FETCH_TIMEOUT_MS = 12000;

const CORS_PROXIES = [
  (url: string) =>
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

function chartUrl(symbol: StockSymbol): string {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?interval=1d&range=6mo"
  );
}

function toKstDateString(unixSec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unixSec * 1000));
}

function finalizeBarsWithMeta(
  bars: OhlcvBar[],
  meta?: YahooChartMeta
): OhlcvBar[] {
  if (!bars.length || meta?.regularMarketPrice == null) return bars;

  const livePrice = meta.regularMarketPrice;
  const liveDate = meta.regularMarketTime
    ? toKstDateString(meta.regularMarketTime)
    : null;
  const last = bars[bars.length - 1];

  if (liveDate && last.date < liveDate) {
    bars.push({
      date: liveDate,
      open: livePrice,
      high: livePrice,
      low: livePrice,
      close: livePrice,
      volume: 0,
    });
    return bars;
  }

  last.close = livePrice;
  last.high = Math.max(last.high, livePrice);
  last.low = Math.min(last.low, livePrice);
  return bars;
}

function parseBarsFromChart(
  json: { chart?: { result?: YahooChartResult[] } },
  symbol: StockSymbol
): OhlcvBar[] {
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const meta = result?.meta;

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
      date: toKstDateString(timestamps[i]),
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

  return finalizeBarsWithMeta(bars, meta);
}

async function fetchJsonTimed(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchChartJson(symbol: StockSymbol): Promise<{
  chart?: { result?: YahooChartResult[] };
}> {
  const direct = chartUrl(symbol);
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) {
    const hosts = [
      direct,
      direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
    ];
    let lastErr: Error | null = null;
    for (const url of hosts) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SemiconductorStock/1.0)",
          },
          next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error(`Yahoo Finance 응답 오류 (${res.status})`);
        return res.json();
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastErr ?? new Error("Yahoo Finance 데이터를 가져오지 못했습니다.");
  }

  const attempts = [
    ...CORS_PROXIES.map((wrap) => wrap(direct)),
    direct.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
  ];

  let lastErr: Error | null = null;
  for (const url of attempts) {
    for (let retry = 0; retry < 2; retry++) {
      try {
        const res = await fetchJsonTimed(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (json.chart?.result?.[0]) return json;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
  }

  throw lastErr ?? new Error("Yahoo Finance 데이터를 가져오지 못했습니다.");
}

function dataJsonUrl(symbol: StockSymbol): string {
  const base =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BASE_PATH != null
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : "";
  return `${base}/data/${symbol}.json`;
}

export async function fetchBundledBars(
  symbol: StockSymbol
): Promise<OhlcvBar[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`${dataJsonUrl(symbol)}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { bars?: OhlcvBar[] };
    if (json.bars && json.bars.length >= 30) return json.bars;
  } catch {
    /* live fetch fallback */
  }
  return null;
}

export async function fetchLiveBars(symbol: StockSymbol): Promise<OhlcvBar[]> {
  const json = await fetchChartJson(symbol);
  return parseBarsFromChart(json, symbol);
}

export async function fetchSixMonthDaily(
  symbol: StockSymbol
): Promise<OhlcvBar[]> {
  try {
    return await fetchLiveBars(symbol);
  } catch (liveErr) {
    const bundled = await fetchBundledBars(symbol);
    if (bundled) return bundled;
    throw liveErr;
  }
}
