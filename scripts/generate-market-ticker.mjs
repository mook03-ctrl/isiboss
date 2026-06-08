/**
 * GitHub Actions / 로컬: Yahoo v8 시세 → data/market-ticker.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SYMBOLS = ["^KS11", "^IXIC", "005930.KS", "000660.KS", "KRW=X"];
const root = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(root, "..", "data", "market-ticker.json");

function chartUrl(symbol) {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?interval=1d&range=5d"
  );
}

function parseQuote(json, symbol) {
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) {
    throw new Error(`${symbol} 시세 없음`);
  }
  let pct = meta.regularMarketChangePercent;
  const prev =
    meta.chartPreviousClose != null
      ? meta.chartPreviousClose
      : meta.previousClose;
  if ((pct == null || Number.isNaN(pct)) && prev > 0) {
    pct = ((meta.regularMarketPrice - prev) / prev) * 100;
  }
  return {
    symbol,
    regularMarketPrice: meta.regularMarketPrice,
    regularMarketChangePercent: pct,
  };
}

async function fetchQuote(symbol) {
  const hosts = [
    chartUrl(symbol),
    chartUrl(symbol).replace("query1.finance.yahoo.com", "query2.finance.yahoo.com"),
  ];
  let lastErr = null;
  for (const url of hosts) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; angrywork-ticker/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseQuote(await res.json(), symbol);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`${symbol} 실패`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

const quotes = {};
for (let i = 0; i < SYMBOLS.length; i += 1) {
  const sym = SYMBOLS[i];
  try {
    quotes[sym] = await fetchQuote(sym);
    console.log(`${sym}: ${quotes[sym].regularMarketPrice}`);
  } catch (e) {
    console.warn(`${sym}: skip (${e.message})`);
  }
  if (i < SYMBOLS.length - 1) await sleep(350);
}

if (Object.keys(quotes).length === 0) {
  console.error("시세 0건 — market-ticker.json 미생성");
  process.exit(1);
}

const payload = { savedAt: Date.now(), quotes };
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile} (${Object.keys(quotes).length} symbols)`);
