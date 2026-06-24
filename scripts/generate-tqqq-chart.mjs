/**
 * GitHub Actions / 로컬: TQQQ 일봉 → data/tqqq-chart.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(root, "..", "data", "tqqq-chart.json");

const URLS = [
  "https://query1.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=2y",
  "https://query2.finance.yahoo.com/v8/finance/chart/TQQQ?interval=1d&range=2y",
];

async function fetchChart() {
  let lastErr = null;
  for (const url of URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; angrywork-tqqq/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("TQQQ fetch failed");
}

const json = await fetchChart();
const result = json.chart?.result?.[0];
const quote = result?.indicators?.quote?.[0];
const meta = result?.meta;

if (!quote?.close?.length) {
  console.error("TQQQ 데이터 없음");
  process.exit(1);
}

const closes = quote.close.slice();
const highs = quote.high.slice();
const timestamps = (result.timestamp || []).slice();

function toEtDateString(unixSec) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unixSec * 1000));
}

if (closes.length > 0 && meta?.regularMarketPrice != null) {
  const livePrice = meta.regularMarketPrice;
  const liveDate = meta.regularMarketTime
    ? toEtDateString(meta.regularMarketTime)
    : null;
  const lastTs = timestamps[timestamps.length - 1];
  const lastDate = lastTs ? toEtDateString(lastTs) : null;

  if (liveDate && lastDate && liveDate > lastDate) {
    closes.push(livePrice);
    highs.push(
      meta.regularMarketDayHigh != null
        ? Math.max(livePrice, meta.regularMarketDayHigh)
        : livePrice
    );
    timestamps.push(meta.regularMarketTime);
  } else {
    closes[closes.length - 1] = livePrice;
    if (meta.regularMarketDayHigh != null) {
      highs[highs.length - 1] = Math.max(
        highs[highs.length - 1] || 0,
        meta.regularMarketDayHigh
      );
    }
  }
}

const payload = {
  savedAt: Date.now(),
  source: "yahoo",
  closes,
  highs,
  timestamps,
  meta: {
    regularMarketPrice: meta?.regularMarketPrice,
    regularMarketTime: meta?.regularMarketTime,
    regularMarketDayHigh: meta?.regularMarketDayHigh,
  },
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile} (${closes.length} bars)`);
