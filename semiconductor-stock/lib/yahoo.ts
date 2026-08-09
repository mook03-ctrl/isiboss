/**
 * 일봉 데이터 로더 — GitHub Pages용 baked JSON (KIS 스크립트가 주기 갱신)
 * 브라우저에서는 KIS 앱키를 쓸 수 없으므로, Actions bake JSON을 재조회하는 것이 "실시간에 가까운" 경로입니다.
 */
import type { OhlcvBar, StockSymbol } from "./types";
import { STOCK_META } from "./types";

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
    const json = (await res.json()) as {
      bars?: OhlcvBar[];
      source?: string;
      fetchedAt?: string;
    };
    if (json.bars && json.bars.length >= 30) return json.bars;
  } catch {
    /* fall through */
  }
  return null;
}

/** bake JSON 재조회 (KIS 크론이 갱신한 최신 파일) */
export async function fetchLiveBars(symbol: StockSymbol): Promise<OhlcvBar[]> {
  const bars = await fetchBundledBars(symbol);
  if (!bars) {
    throw new Error(
      `${STOCK_META[symbol].name} 시세 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.`
    );
  }
  return bars;
}

export async function fetchSixMonthDaily(
  symbol: StockSymbol
): Promise<OhlcvBar[]> {
  return fetchLiveBars(symbol);
}
