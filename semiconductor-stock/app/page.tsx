"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import BuyScoreDashboard from "@/components/BuyScoreDashboard";
import MarketRegimeBanner from "@/components/MarketRegimeBanner";
import StockChart from "@/components/StockChart";
import {
  fetchStockBundleFast,
  fetchStockBundleLive,
} from "@/lib/stockBundle";
import type { StockApiResponse, StockSymbol } from "@/lib/types";
import { STOCK_META } from "@/lib/types";

const SYMBOLS: StockSymbol[] = ["005930.KS", "000660.KS"];
const REFRESH_MS = 3 * 60 * 1000;

export default function HomePage() {
  const [symbol, setSymbol] = useState<StockSymbol>("005930.KS");
  const [data, setData] = useState<StockApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveCacheRef = useRef<Partial<Record<StockSymbol, StockApiResponse>>>(
    {}
  );
  const loadGenRef = useRef(0);

  const load = useCallback(async (sym: StockSymbol, opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    const gen = ++loadGenRef.current;

    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    let seeded = liveCacheRef.current[sym] || null;
    if (!seeded) {
      const fast = await fetchStockBundleFast(sym);
      if (gen !== loadGenRef.current) return;
      if (fast) {
        seeded = fast;
        setData(fast);
        setLoading(false);
      }
    } else if (!silent) {
      setData(seeded);
      setLoading(false);
    }

    try {
      const fresh = await fetchStockBundleLive(sym, {
        retries: silent ? 0 : 1,
      });
      if (gen !== loadGenRef.current) return;
      liveCacheRef.current[sym] = fresh;
      setData(fresh);
      setError(null);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      if (seeded) {
        setData(seeded);
        if (!silent) {
          setError("실시간 연결 실패 — 저장된 일봉을 표시합니다.");
        }
        return;
      }
      if (!silent) {
        setData(null);
        setError(e instanceof Error ? e.message : "알 수 없는 오류");
      }
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const prefetchLive = useCallback((sym: StockSymbol) => {
    fetchStockBundleFast(sym)
      .then((fast) => {
        if (fast) liveCacheRef.current[sym] = fast;
      })
      .catch(() => {});
    fetchStockBundleLive(sym, { retries: 0 })
      .then((fresh) => {
        liveCacheRef.current[sym] = fresh;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    load(symbol);

    SYMBOLS.forEach((sym) => {
      if (sym !== symbol) prefetchLive(sym);
    });

    const timer = window.setInterval(function () {
      load(symbol, { silent: true });
    }, REFRESH_MS);

    function onVisible() {
      if (!document.hidden) {
        load(symbol, { silent: !!liveCacheRef.current[symbol] });
      }
    }

    function onPageShow(ev: PageTransitionEvent) {
      if (ev.persisted) {
        load(symbol);
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [symbol, load, prefetchLive]);

  const lastDate = data?.candles[data.candles.length - 1]?.time;

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
          disabled={loading || refreshing}
          className="ml-auto rounded-lg border-2 border-accent px-3 py-2 text-sm font-medium text-accent disabled:opacity-50"
        >
          {loading || refreshing ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}

      {loading && !data && (
        <p className="text-center text-sm text-ink/50">차트 불러오는 중…</p>
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
            lastDate={lastDate}
            refreshing={refreshing}
          />
          <BuyScoreDashboard
            analysis={data.analysis}
            stockName={data.name}
          />
        </>
      )}

      <footer className="border-t border-ink/10 pt-4 text-center text-xs text-ink/45">
        Dual Mode A/B · angrywork.com · 저장 일봉 즉시 표시 · 실시간 갱신 시도
      </footer>
    </div>
  );
}
