/**
 * GitHub Actions / 로컬: 일봉 → public/data/*.json
 * 우선순위: 한국투자증권(KIS) Open API → Yahoo Finance 폴백
 *
 * 환경변수:
 *   KIS_APP_KEY, KIS_APP_SECRET  (필수, KIS 사용 시)
 *   KIS_ENV=vps                  (모의투자 API 서버)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  fetchSixMonthBarsWithLive,
  hasKisCredentials,
  yahooSymbolToKisCode,
} from "./kis-client.mjs";

const SYMBOLS = ["005930.KS", "000660.KS"];
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "public", "data");

function chartUrl(symbol) {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?interval=1d&range=6mo"
  );
}

async function fetchBarsYahoo(symbol) {
  const res = await fetch(chartUrl(symbol), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiconductorStock/1.0)" },
  });
  if (!res.ok) throw new Error(`${symbol} Yahoo ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const meta = result?.meta;
  const bars = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote?.open?.[i];
    const high = quote?.high?.[i];
    const low = quote?.low?.[i];
    const close = quote?.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    const ts = timestamps[i];
    bars.push({
      date: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(ts * 1000)),
      open,
      high,
      low,
      close,
      volume: quote?.volume?.[i] ?? 0,
    });
  }
  if (bars.length < 30) throw new Error(`${symbol} 데이터 부족`);

  if (meta?.regularMarketPrice != null && bars.length) {
    const livePrice = meta.regularMarketPrice;
    const liveDate = meta.regularMarketTime
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(meta.regularMarketTime * 1000))
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
    } else {
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
    }
  }

  return bars;
}

async function fetchBars(symbol) {
  if (hasKisCredentials()) {
    const code = yahooSymbolToKisCode(symbol);
    const bars = await fetchSixMonthBarsWithLive(code);
    return { bars, source: "kis" };
  }

  console.warn(
    `[warn] KIS 키 없음 → Yahoo 폴백 (${symbol}). ` +
      "GitHub Secrets에 KIS_APP_KEY / KIS_APP_SECRET 을 등록하세요."
  );
  const bars = await fetchBarsYahoo(symbol);
  return { bars, source: "yahoo" };
}

fs.mkdirSync(outDir, { recursive: true });

const sourceLabel = hasKisCredentials() ? "kis" : "yahoo-fallback";
console.log(`Baking semiconductor stock JSON via ${sourceLabel}…`);

for (const symbol of SYMBOLS) {
  const file = path.join(outDir, `${symbol}.json`);
  try {
    const { bars, source } = await fetchBars(symbol);
    fs.writeFileSync(
      file,
      JSON.stringify({
        symbol,
        source,
        fetchedAt: new Date().toISOString(),
        bars,
      })
    );
    const last = bars[bars.length - 1];
    console.log(
      `Wrote ${file} (${bars.length} bars, last=${last?.date} close=${last?.close}, source=${source})`
    );
  } catch (e) {
    if (fs.existsSync(file)) {
      console.warn(
        `[warn] ${symbol} bake 실패 — 기존 JSON 유지:`,
        e instanceof Error ? e.message : e
      );
      continue;
    }
    throw e;
  }
}
