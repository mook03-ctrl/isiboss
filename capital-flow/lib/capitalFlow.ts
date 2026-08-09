/**
 * Shared aggregation helpers used by the client & docs.
 * Live Node fetch lives in scripts/generate-capital-flow.mjs (yahoo-finance2).
 */
import type { CapitalAsset, CapitalFlowPayload, SemiconductorSignal } from "./types";

export function buildSemiconductorSignal(
  assets: CapitalAsset[]
): SemiconductorSignal {
  const smh = assets.find((a) => a.symbol === "SMH");
  const risk = assets.filter((a) => a.category.startsWith("risk"));
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

  let kind: SemiconductorSignal["kind"] = "NEUTRAL";
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
      "위험 자산 전체 모멘텀이 유지되는 가운데 SMH 상대 강도가 섹터·안전자산을 상회합니다. 반도체로 자본 유입(로테이션) 신호가 우세합니다.";
  } else if (smhOutflow || (smhChange < 0 && smhWeightDeltaProxy < -0.5)) {
    kind = "OUTFLOW_WARNING";
    label = "OUTFLOW WARNING";
    summary =
      "SMH 모멘텀이 약하고 헬스케어·금·금융 등 여타 자산 대비 상대 약세입니다. 반도체에서 자금이 이탈하는 구간일 수 있습니다.";
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

export function recomputeSignal(payload: CapitalFlowPayload): CapitalFlowPayload {
  return {
    ...payload,
    signal: buildSemiconductorSignal(payload.assets),
  };
}
