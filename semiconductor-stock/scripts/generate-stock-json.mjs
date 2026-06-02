/**
 * GitHub Actions / 로컬 빌드: Yahoo 일봉 → public/data/*.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SYMBOLS = ["005930.KS", "000660.KS"];
const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "public", "data");

function chartUrl(symbol) {
  return (
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    "?interval=1d&range=6mo"
  );
}

async function fetchBars(symbol) {
  const res = await fetch(chartUrl(symbol), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SemiconductorStock/1.0)" },
  });
  if (!res.ok) throw new Error(`${symbol} Yahoo ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const bars = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote?.open?.[i];
    const high = quote?.high?.[i];
    const low = quote?.low?.[i];
    const close = quote?.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: quote?.volume?.[i] ?? 0,
    });
  }
  if (bars.length < 30) throw new Error(`${symbol} 데이터 부족`);
  return bars;
}

fs.mkdirSync(outDir, { recursive: true });

for (const symbol of SYMBOLS) {
  const bars = await fetchBars(symbol);
  const file = path.join(outDir, `${symbol}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ symbol, fetchedAt: new Date().toISOString(), bars })
  );
  console.log(`Wrote ${file} (${bars.length} bars)`);
}
