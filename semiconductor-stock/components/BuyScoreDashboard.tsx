import type { DualBuyAnalysis, ModeScoreResult } from "@/lib/types";

interface BuyScoreDashboardProps {
  analysis: DualBuyAnalysis;
  stockName: string;
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "text-buy border-buy";
  if (score >= 70) return "text-accent border-accent";
  if (score >= 50) return "text-warn border-warn";
  return "text-ink/60 border-ink/30";
}

function ModeCard({
  mode,
  isRecommended,
}: {
  mode: ModeScoreResult;
  isRecommended: boolean;
}) {
  const accentBorder =
    mode.mode === "A"
      ? "border-blue-600"
      : "border-orange-500";

  return (
    <article
      className={`flex flex-col rounded-2xl border-2 bg-white p-4 shadow-[3px_3px_0_#141414] sm:p-5 ${accentBorder} ${
        isRecommended ? "ring-2 ring-accent ring-offset-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold">{mode.title}</h3>
          <p className="text-sm text-ink/60">{mode.subtitle}</p>
        </div>
        {isRecommended && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
            장세 추천
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-4 ${scoreRingColor(mode.score)}`}
        >
          <span className="text-2xl font-bold">{mode.score}</span>
          <span className="text-xs opacity-70">/ 100</span>
        </div>
        <div>
          <p className="text-xl font-bold text-accent">{mode.statusText}</p>
          {mode.isBuyRecommended && mode.stopLoss != null && (
            <p className="mt-2 text-sm font-semibold text-red-600">
              ⚠️ 권장 손절가: {Math.round(mode.stopLoss).toLocaleString("ko-KR")}
              원 (원칙 매매 필수)
            </p>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {mode.conditions.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              c.met
                ? "border-buy/40 bg-green-50"
                : "border-ink/15 bg-paper"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{c.label}</span>
                <span className="ml-1.5 text-xs text-ink/55">— {c.meaning}</span>
              </div>
              <span
                className={`shrink-0 text-xs font-bold ${
                  c.met ? "text-buy" : "text-ink/45"
                }`}
              >
                {c.met ? `+${c.points}` : "0"}점
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/60">{c.detail}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function BuyScoreDashboard({
  analysis,
  stockName,
}: BuyScoreDashboardProps) {
  const { recommendedMode, label } = analysis.marketRegime;
  const bothRecommended = label === "횡보장";

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-ink/15 bg-white/80 px-3 py-2 text-sm text-ink/65">
        <span className="font-semibold text-ink">{stockName}</span> · 기준일{" "}
        {analysis.date} · 듀얼 모드 점수 (실전 투자 참고용, 투자 책임은 본인)
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModeCard
          mode={analysis.modeA}
          isRecommended={bothRecommended || recommendedMode === "A"}
        />
        <ModeCard
          mode={analysis.modeB}
          isRecommended={bothRecommended || recommendedMode === "B"}
        />
      </div>
    </section>
  );
}
