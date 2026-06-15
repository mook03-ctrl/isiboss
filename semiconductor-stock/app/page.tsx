"use client";

import { useCallback, useEffect, useState } from "react";

import BuyScoreDashboard from "@/components/BuyScoreDashboard";
import MarketRegimeBanner from "@/components/MarketRegimeBanner";
import StockChart from "@/components/StockChart";
import { fetchStockBundle } from "@/lib/stockBundle";
import type { StockApiResponse, StockSymbol } from "@/lib/types";
import { STOCK_META } from "@/lib/types";

const SYMBOLS: StockSymbol[] = ["005930.KS", "000660.KS"];
const REFRESH_MS = 3 * 60 * 1000;

async function loadStockData(sym: StockSymbol): Promise<StockApiResponse> {
  return fetchStockBundle(sym);
}

export default function HomePage() {
  const [symbol, setSymbol] = useState<StockSymbol>("005930.KS");
  const [data, setData] = useState<StockApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (sym: StockSymbol, opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      setData(await loadStockData(sym));
      setError(null);
    } catch (e) {
      if (!silent) {
        setData(null);
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(symbol);
    const timer = window.setInterval(function () {
      load(symbol, { silent: true });
    }, REFRESH_MS);

    function onVisible() {
      if (!document.hidden) load(symbol, { silent: true });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [symbol, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {SYMBOLS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => setSymbol(sym)}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
              symbol === sym
                ? "border-ink bg-ink text-paper shadow-[2px_2px_0_#141414]"
                : "border-ink/25 bg-white hover:border-ink"
            }`}
          >
            {STOCK_META[sym].name}{" "}
            <span className="font-normal opacity-70">
              ({STOCK_META[sym].short})
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => load(symbol)}
          disabled={loading}
          className="ml-auto rounded-lg border-2 border-accent px-3 py-2 text-sm font-medium text-accent disabled:opacity-50"
        >
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="text-center text-sm text-ink/50">
          Yahoo Finance에서 일봉·듀얼 모드 점수를 계산하는 중…
        </p>
      )}

      {data && (
        <>
          <MarketRegimeBanner
            analysis={data.analysis}
            stockName={data.name}
          />
          <StockChart
            candles={data.candles}
            title={`${data.name} (${STOCK_META[data.symbol].short})`}
          />
          <BuyScoreDashboard
            analysis={data.analysis}
            stockName={data.name}
          />
        </>
      )}

      <footer className="border-t border-ink/10 pt-4 text-center text-xs text-ink/45">
        Dual Mode A/B · angrywork.com · lightweight-charts · 3분마다 자동 갱신
      </footer>
    </div>
  );
}
