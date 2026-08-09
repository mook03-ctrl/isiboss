"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

import type { CapitalAsset } from "@/lib/types";
import { formatPct, formatUsd } from "@/lib/utils";

interface Props {
  assets: CapitalAsset[];
}

interface LeafLayout extends CapitalAsset {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function flowColor(change24h: number): string {
  if (change24h > 0.25) return "#9f1239";
  if (change24h > 0) return "#be123c";
  if (change24h < -0.25) return "#1e3a8a";
  if (change24h < 0) return "#1d4ed8";
  return "#334155";
}

export default function CapitalTreemap({ assets }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [hover, setHover] = useState<CapitalAsset | null>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({
        w: Math.max(cr.width, 280),
        h: Math.max(Math.min(cr.width * 0.62, 520), 320),
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const leaves = useMemo((): LeafLayout[] => {
    if (!assets.length) return [];

    type Node = { name: string; value?: number; asset?: CapitalAsset; children?: Node[] };

    const root = d3
      .hierarchy<Node>({
        name: "root",
        children: assets.map((a) => ({
          name: a.symbol,
          value: Math.max(a.dollarVolume, 1),
          asset: a,
        })),
      })
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap<Node>().size([size.w, size.h]).paddingInner(3).paddingOuter(2).round(true)(
      root
    );

    return root.leaves().flatMap((n) => {
      const a = n.data.asset;
      if (!a) return [];
      const rn = n as d3.HierarchyRectangularNode<Node>;
      return [
        {
          ...a,
          x0: rn.x0,
          y0: rn.y0,
          x1: rn.x1,
          y1: rn.y1,
        },
      ];
    });
  }, [assets, size.w, size.h]);

  return (
    <section className="rounded-xl border border-terminal-border bg-terminal-panel p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-terminal-text">
            Global Capital Flow Treemap
          </h2>
          <p className="text-xs text-terminal-muted">
            타일 크기 = 달러 거래량 비중 · 색 = 24h 유출입
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] text-terminal-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-800" />
            Inflow
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-800" />
            Outflow
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-600" />
            Neutral
          </li>
        </ul>
      </div>

      <div ref={wrapRef} className="relative w-full">
        <svg
          width={size.w}
          height={size.h}
          className="block w-full overflow-hidden rounded-lg bg-black/40"
          onMouseLeave={() => setHover(null)}
        >
          {leaves.map((n) => {
            const w = Math.max(n.x1 - n.x0, 0);
            const h = Math.max(n.y1 - n.y0, 0);
            const isSmh = n.symbol === "SMH" || n.highlight;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x0},${n.y0})`}
                className="cursor-pointer"
                onMouseMove={(e) => {
                  setHover(n);
                  const rect = wrapRef.current?.getBoundingClientRect();
                  if (rect) {
                    setCursor({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
              >
                <rect
                  width={w}
                  height={h}
                  rx={4}
                  fill={flowColor(n.change24h)}
                  stroke={isSmh ? "#f59e0b" : "rgba(255,255,255,0.12)"}
                  strokeWidth={isSmh ? 2.5 : 1}
                />
                {w > 56 && h > 36 && (
                  <text
                    x={8}
                    y={18}
                    fill="#f8fafc"
                    fontSize={12}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={600}
                  >
                    {n.symbol}
                  </text>
                )}
                {w > 72 && h > 52 && (
                  <text
                    x={8}
                    y={34}
                    fill="rgba(248,250,252,0.75)"
                    fontSize={11}
                    fontFamily="ui-monospace, monospace"
                  >
                    {n.weight.toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border border-terminal-border bg-terminal-bg/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: Math.min(cursor.x + 12, size.w - 220),
              top: Math.max(cursor.y - 8, 4),
            }}
          >
            <p className="font-semibold text-terminal-text">{hover.nameKo}</p>
            <p className="mt-1 text-terminal-muted">{hover.name}</p>
            <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-terminal-text/90">
              <div className="flex justify-between gap-4">
                <dt className="text-terminal-muted">Dollar Vol</dt>
                <dd>{formatUsd(hover.dollarVolume)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-terminal-muted">Weight</dt>
                <dd>{hover.weight.toFixed(2)}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-terminal-muted">24h Flow</dt>
                <dd
                  className={
                    hover.change24h >= 0 ? "text-rose-400" : "text-blue-400"
                  }
                >
                  {formatPct(hover.change24h)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-terminal-muted">Flow $</dt>
                <dd>{formatUsd(hover.flowEstimate)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
