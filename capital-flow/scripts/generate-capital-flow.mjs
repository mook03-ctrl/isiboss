/**
 * Zero-key bake: Yahoo chart v8 + CoinGecko → public/data/capital-flow.json
 * yahoo-finance2 우선, rate-limit 시 공개 chart API 폴백 (API 키 없음)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "..", "public", "data");
const outFile = path.join(outDir, "capital-flow.json");

const YAHOO_TICKERS = [
  { symbol: "GLD", name: "SPDR Gold Shares", nameKo: "금 (GLD)", category: "safe" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury", nameKo: "미 국채 (TLT)", category: "safe" },
  {
    symbol: "SMH",
    name: "VanEck Semiconductor ETF",
    nameKo: "반도체 (SMH)",
    category: "risk-equity",
    highlight: true,
  },
  {
    symbol: "BOTZ",
    name: "Global X Robotics & AI",
    nameKo: "AI·로보틱스 (BOTZ)",
    category: "risk-equity",
  },
  {
    symbol: "XLV",
    name: "Health Care Select Sector",
    nameKo: "헬스케어 (XLV)",
    category: "risk-equity",
  },
  {
    symbol: "CARZ",
    name: "First Trust NASDAQ Global Auto",
    nameKo: "자동차 (CARZ)",
    category: "risk-equity",
  },
  {
    symbol: "XLF",
    name: "Financial Select Sector",
    nameKo: "금융 (XLF)",
    category: "risk-equity",
  },
];

function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchChartQuote(symbol) {
  const hosts = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
  ];
  let lastErr;
  for (const url of hosts) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; angrywork-capital-flow/1.0)",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      const meta = result?.meta;
      const quote = result?.indicators?.quote?.[0];
      if (!meta?.regularMarketPrice && !quote?.close?.length) {
        throw new Error("empty chart");
      }
      const closes = quote?.close || [];
      const volumes = quote?.volume || [];
      let lastIdx = closes.length - 1;
      while (lastIdx >= 0 && closes[lastIdx] == null) lastIdx -= 1;
      const price =
        num(meta.regularMarketPrice) ||
        (lastIdx >= 0 ? num(closes[lastIdx]) : 0);
      const volume =
        lastIdx >= 0
          ? num(volumes[lastIdx])
          : num(meta.regularMarketVolume);
      let changePct = num(meta.regularMarketChangePercent);
      if (!changePct && lastIdx > 0 && closes[lastIdx - 1]) {
        const prev = num(closes[lastIdx - 1]);
        if (prev > 0) changePct = ((price - prev) / prev) * 100;
      }
      return {
        symbol,
        regularMarketPrice: price,
        regularMarketVolume: volume,
        regularMarketChangePercent: changePct,
        marketCap: meta.marketCap != null ? num(meta.marketCap) : null,
        shortName: meta.shortName || meta.symbol || symbol,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`${symbol} chart failed`);
}

async function fetchYahooFinance2(symbol) {
  try {
    const mod = await import("yahoo-finance2");
    const yahooFinance = mod.default || mod;
    if (typeof yahooFinance.suppressNotices === "function") {
      yahooFinance.suppressNotices(["yahooSurvey"]);
    }
    const q = await yahooFinance.quote(symbol);
    return {
      symbol,
      regularMarketPrice: num(q.regularMarketPrice),
      regularMarketVolume: num(q.regularMarketVolume),
      regularMarketChangePercent: num(q.regularMarketChangePercent),
      marketCap: q.marketCap != null ? num(q.marketCap) : null,
      shortName: q.shortName || symbol,
    };
  } catch {
    return null;
  }
}

async function fetchYahooQuotes() {
  const map = new Map();
  for (const { symbol } of YAHOO_TICKERS) {
    let q = await fetchYahooFinance2(symbol);
    if (!q || !q.regularMarketPrice) {
      try {
        q = await fetchChartQuote(symbol);
      } catch (e) {
        console.warn(`[yahoo] ${symbol}`, e?.message || e);
        q = null;
      }
    }
    if (q) map.set(symbol, q);
    await delay(450);
  }
  return map;
}

async function fetchCrypto() {
  const url =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const rows = await res.json();
  let dollarVolume = 0;
  let marketCap = 0;
  let weightedChange = 0;
  let weightSum = 0;
  let priceBtc = 0;
  for (const row of rows) {
    const vol = num(row.total_volume);
    const chg = num(row.price_change_percentage_24h);
    dollarVolume += vol;
    marketCap += num(row.market_cap);
    weightedChange += chg * vol;
    weightSum += vol;
    if (row.id === "bitcoin") priceBtc = num(row.current_price);
  }
  return {
    dollarVolume,
    change24h: weightSum > 0 ? weightedChange / weightSum : 0,
    price: priceBtc,
    marketCap,
  };
}

function buildSignal(assets) {
  const smh = assets.find((a) => a.symbol === "SMH");
  const risk = assets.filter((a) => String(a.category).startsWith("risk"));
  const otherSectors = assets.filter(
    (a) =>
      (a.category === "risk-equity" && a.symbol !== "SMH") ||
      a.category === "safe"
  );
  const smhWeight = smh?.weight ?? 0;
  const smhChange = smh?.change24h ?? 0;
  const otherAvgChange =
    otherSectors.length > 0
      ? otherSectors.reduce((s, a) => s + a.change24h, 0) / otherSectors.length
      : 0;
  const riskVolumeChangeAvg =
    risk.length > 0
      ? risk.reduce((s, a) => s + a.change24h, 0) / risk.length
      : 0;
  const smhWeightDeltaProxy = smhChange - otherAvgChange;
  const netFlowEstimate = smh?.flowEstimate ?? 0;
  const riskDollar = risk.reduce((s, a) => s + a.dollarVolume, 0);
  const averageRisk =
    risk.length > 1
      ? (riskDollar - (smh?.dollarVolume ?? 0)) / Math.max(risk.length - 1, 1)
      : riskDollar;
  const relativeVolumeRatio =
    averageRisk > 0 ? (smh?.dollarVolume ?? 0) / averageRisk : 1;

  let kind = "NEUTRAL";
  let label = "NEUTRAL / CONSOLIDATION";
  let summary =
    "위험 자산과 반도체 간 자금 흐름이 균형을 이루는 구간입니다. 추세 확인 후 분할 대응하세요.";

  const riskRising = riskVolumeChangeAvg > 0.15;
  const smhOutflow =
    smhChange < -0.2 && otherSectors.some((a) => a.change24h > 0.15);

  if (riskRising && smhWeightDeltaProxy > 0.35 && smhChange > 0) {
    kind = "STRONG_BUY";
    label = "STRONG BUY / ACCUMULATION";
    summary =
      "위험 자산 전체 모멘텀이 유지되는 가운데 SMH 상대 강도가 상회합니다. 반도체로 자본 유입 신호가 우세합니다.";
  } else if (smhOutflow || (smhChange < 0 && smhWeightDeltaProxy < -0.5)) {
    kind = "OUTFLOW_WARNING";
    label = "OUTFLOW WARNING";
    summary =
      "SMH 모멘텀이 약하고 여타 자산 대비 상대 약세입니다. 반도체 자금 이탈 구간일 수 있습니다.";
  }

  return {
    kind,
    label,
    summary,
    smhWeight,
    smhWeightDeltaProxy,
    netFlowEstimate,
    relativeVolumeRatio,
    riskVolumeChangeAvg,
  };
}

async function buildPayload() {
  const [quotes, crypto] = await Promise.all([
    fetchYahooQuotes(),
    fetchCrypto().catch((e) => {
      console.warn("[coingecko]", e?.message || e);
      return null;
    }),
  ]);
  const raw = [];

  for (const meta of YAHOO_TICKERS) {
    const q = quotes.get(meta.symbol);
    if (!q) continue;
    const price = num(q.regularMarketPrice);
    const volume = num(q.regularMarketVolume);
    const change24h = num(q.regularMarketChangePercent);
    const dollarVolume = price * volume;
    if (dollarVolume <= 0 || price <= 0) continue;
    raw.push({
      id: meta.symbol,
      symbol: meta.symbol,
      name: q.shortName || meta.name,
      nameKo: meta.nameKo,
      category: meta.category,
      price,
      volume,
      dollarVolume,
      change24h,
      marketCap: q.marketCap != null ? num(q.marketCap) : null,
      highlight: !!meta.highlight,
    });
  }

  if (crypto && crypto.dollarVolume > 0) {
    raw.push({
      id: "CRYPTO",
      symbol: "BTC+ETH",
      name: "Bitcoin + Ethereum",
      nameKo: "암호화폐 (BTC+ETH)",
      category: "risk-crypto",
      price: crypto.price,
      volume: crypto.dollarVolume,
      dollarVolume: crypto.dollarVolume,
      change24h: crypto.change24h,
      marketCap: crypto.marketCap,
    });
  }

  const totalDollarVolume = raw.reduce((s, a) => s + a.dollarVolume, 0);
  if (totalDollarVolume <= 0) throw new Error("total dollar volume is 0");

  const assets = raw
    .map((a) => {
      const weight = (a.dollarVolume / totalDollarVolume) * 100;
      const flowEstimate = a.dollarVolume * (a.change24h / 100);
      return { ...a, weight, flowEstimate };
    })
    .sort((a, b) => b.dollarVolume - a.dollarVolume);

  return {
    source: "yahoo-chart+yahoo-finance2+coingecko",
    fetchedAt: new Date().toISOString(),
    totalDollarVolume,
    assets,
    signal: buildSignal(assets),
  };
}

async function main() {
  console.log("Baking capital-flow JSON…");
  try {
    const payload = await buildPayload();
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
    console.log(
      `Wrote ${outFile} (${payload.assets.length} assets, signal=${payload.signal.kind})`
    );
  } catch (e) {
    if (fs.existsSync(outFile)) {
      console.warn("[warn] bake failed — keeping existing JSON:", e);
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  }
}

main();
