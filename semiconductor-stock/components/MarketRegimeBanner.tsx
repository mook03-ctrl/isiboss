import type { DualBuyAnalysis } from "@/lib/types";

interface MarketRegimeBannerProps {
  analysis: DualBuyAnalysis;
  stockName: string;
}

const REGIME_STYLES: Record<
  DualBuyAnalysis["marketRegime"]["label"],
  string
> = {
  "대세 상승장": "border-buy bg-green-50",
  횡보장: "border-warn bg-amber-50",
  하락장: "border-red-400 bg-red-50",
};

export default function MarketRegimeBanner({
  analysis,
  stockName,
}: MarketRegimeBannerProps) {
  const { marketRegime, date, close } = analysis;
  const regimeClass = REGIME_STYLES[marketRegime.label];

  return (
    <section
      className={`rounded-2xl border-2 p-4 shadow-[4px_4px_0_#141414] sm:p-5 ${regimeClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink/50">
            시장 국면 · {stockName} · {date}
          </p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">
            현재 시장 상태:{" "}
            <span className="text-accent">{marketRegime.label}</span>
          </h2>
          <p className="mt-2 text-sm text-ink/70">
            종가 {Math.round(close).toLocaleString("ko-KR")}원 ·{" "}
            {marketRegime.detail}
          </p>
        </div>
        <span className="rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_#141414]">
          {marketRegime.recommendationBadge}
        </span>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        SMA60 기울기가 {marketRegime.slopeDirection}일 때 Mode{" "}
        {marketRegime.recommendedMode === "A" ? "A(바닥)" : "B(추세)"} 전략을
        우선 참고하세요. 두 모드 점수를 함께 비교하는 것이 안전합니다.
      </p>
    </section>
  );
}
