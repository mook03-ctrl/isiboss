"use client";

import type { ReactNode } from "react";
import type { SemiconductorSignal } from "@/lib/types";
import { cn, formatPct, formatUsd } from "@/lib/utils";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface Props {
  signal: SemiconductorSignal;
}

export default function SemiconductorSignalPanel({ signal }: Props) {
  const isBuy = signal.kind === "STRONG_BUY";
  const isWarn = signal.kind === "OUTFLOW_WARNING";

  return (
    <section
      className={cn(
        "rounded-xl border p-4 sm:p-5",
        isBuy && "border-rose-500/60 bg-rose-950/30",
        isWarn && "border-blue-500/60 bg-blue-950/30",
        !isBuy && !isWarn && "border-terminal-border bg-terminal-panel"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-terminal-accent" />
        <h2 className="text-sm font-semibold tracking-wide text-terminal-text">
          Semiconductor Timing · SMH
        </h2>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isBuy && <ArrowUpRight className="h-5 w-5 text-rose-400" />}
        {isWarn && <AlertTriangle className="h-5 w-5 text-blue-400" />}
        {!isBuy && !isWarn && <Minus className="h-5 w-5 text-terminal-muted" />}
        <p
          className={cn(
            "font-mono text-lg font-bold tracking-tight sm:text-xl",
            isBuy && "text-rose-400",
            isWarn && "text-blue-400",
            !isBuy && !isWarn && "text-terminal-muted"
          )}
        >
          {signal.label}
        </p>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-terminal-muted">
        {signal.summary}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="SMH Market Share"
          value={`${signal.smhWeight.toFixed(2)}%`}
          hint="전체 달러 거래량 비중"
        />
        <Metric
          label="24h Net Flow Est."
          value={formatUsd(signal.netFlowEstimate)}
          hint="Dollar Vol × 24h 변동률"
          positive={signal.netFlowEstimate > 0}
          negative={signal.netFlowEstimate < 0}
          icon={
            signal.netFlowEstimate > 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : signal.netFlowEstimate < 0 ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null
          }
        />
        <Metric
          label="Relative Volume"
          value={`${signal.relativeVolumeRatio.toFixed(2)}×`}
          hint="SMH $V ÷ 기타 리스크 평균"
        />
      </div>

      <p className="mt-3 font-mono text-[11px] text-terminal-muted/80">
        Δ proxy {formatPct(signal.smhWeightDeltaProxy)} · risk avg{" "}
        {formatPct(signal.riskVolumeChangeAvg)}
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  positive,
  negative,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
  negative?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-terminal-border/80 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-terminal-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1 font-mono text-base font-semibold",
          positive && "text-rose-400",
          negative && "text-blue-400",
          !positive && !negative && "text-terminal-text"
        )}
      >
        {icon}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-terminal-muted/70">{hint}</p>
    </div>
  );
}
