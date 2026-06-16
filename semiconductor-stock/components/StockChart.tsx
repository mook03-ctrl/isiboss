"use client";

import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { ChartCandle } from "@/lib/types";

interface StockChartProps {
  candles: ChartCandle[];
  title: string;
  lastDate?: string;
  refreshing?: boolean;
}

export default function StockChart({
  candles,
  title,
  lastDate,
  refreshing,
}: StockChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#141414",
      },
      grid: {
        vertLines: { color: "rgba(20,20,20,0.06)" },
        horzLines: { color: "rgba(20,20,20,0.06)" },
      },
      width: containerRef.current.clientWidth,
      height: 380,
      rightPriceScale: { borderColor: "rgba(20,20,20,0.15)" },
      timeScale: { borderColor: "rgba(20,20,20,0.15)" },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#15803d",
      downColor: "#b91c1c",
      borderUpColor: "#15803d",
      borderDownColor: "#b91c1c",
      wickUpColor: "#15803d",
      wickDownColor: "#b91c1c",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <section className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_#141414] sm:p-5">
      <h2 className="mb-1 text-lg font-semibold">{title} · 6개월 일봉</h2>
      <p className="mb-3 text-xs text-ink/50">
        {lastDate ? `최근 일봉 ${lastDate}` : "일봉 로딩 중"}
        {refreshing ? " · 실시간 갱신 중…" : ""}
      </p>
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg" />
    </section>
  );
}
