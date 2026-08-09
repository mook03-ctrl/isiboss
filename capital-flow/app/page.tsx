"use client";

import { RefreshCw } from "lucide-react";
import useSWR from "swr";

import CapitalTreemap from "@/components/CapitalTreemap";
import SemiconductorSignalPanel from "@/components/SemiconductorSignal";
import type { CapitalFlowPayload } from "@/lib/types";
import { formatUsd } from "@/lib/utils";

const base =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH != null
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : "";

const DATA_URL = `${base}/data/capital-flow.json`;

async function fetcher(url: string): Promise<CapitalFlowPayload> {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`시세 데이터 HTTP ${res.status}`);
  return res.json();
}

export default function HomePage() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    DATA_URL,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
    }
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-terminal-muted">
            안전자산 · 암호화폐 · 섹터 ETF 달러 거래량 비중 (100% 정규화). 반도체 SMH
            타이밍 참고용.
          </p>
          {data && (
            <p className="mt-1 font-mono text-[11px] text-terminal-muted/80">
              source {data.source} · total $V {formatUsd(data.totalDollarVolume)} ·{" "}
              {new Date(data.fetchedAt).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          className="inline-flex items-center gap-1.5 rounded-md border border-terminal-border bg-terminal-panel px-3 py-1.5 text-xs font-medium text-terminal-text disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`}
          />
          새로고침
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          데이터를 불러오지 못했습니다. 배포 bake 후 다시 시도해 주세요. (
          {error.message})
        </p>
      )}

      {isLoading && !data && (
        <p className="text-center text-sm text-terminal-muted">자본 흐름 불러오는 중…</p>
      )}

      {data && (
        <>
          <SemiconductorSignalPanel signal={data.signal} />
          <CapitalTreemap assets={data.assets} />
          <AssetTable assets={data.assets} />
        </>
      )}

      <footer className="border-t border-terminal-border pt-4 text-center text-[11px] text-terminal-muted">
        Zero-key · yahoo-finance2 + CoinGecko bake · API 키 불필요 · 참고용이며
        투자 조언이 아닙니다
      </footer>
    </div>
  );
}

function AssetTable({ assets }: { assets: CapitalFlowPayload["assets"] }) {
  return (
    <section className="overflow-x-auto rounded-xl border border-terminal-border bg-terminal-panel">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="border-b border-terminal-border font-mono text-[10px] uppercase tracking-wider text-terminal-muted">
          <tr>
            <th className="px-3 py-2">Asset</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Dollar Vol</th>
            <th className="px-3 py-2">Weight</th>
            <th className="px-3 py-2">24h</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr
              key={a.id}
              className="border-b border-terminal-border/60 font-mono last:border-0"
            >
              <td className="px-3 py-2">
                <span
                  className={
                    a.symbol === "SMH"
                      ? "font-semibold text-terminal-accent"
                      : "text-terminal-text"
                  }
                >
                  {a.nameKo}
                </span>
              </td>
              <td className="px-3 py-2 text-terminal-muted">
                {formatUsd(a.price, false)}
              </td>
              <td className="px-3 py-2">{formatUsd(a.dollarVolume)}</td>
              <td className="px-3 py-2">{a.weight.toFixed(2)}%</td>
              <td
                className={
                  a.change24h >= 0
                    ? "px-3 py-2 text-rose-400"
                    : "px-3 py-2 text-blue-400"
                }
              >
                {a.change24h >= 0 ? "+" : ""}
                {a.change24h.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
