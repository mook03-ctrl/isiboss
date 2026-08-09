export type AssetCategory = "safe" | "risk-crypto" | "risk-equity";

export type SignalKind =
  | "STRONG_BUY"
  | "OUTFLOW_WARNING"
  | "NEUTRAL";

export interface CapitalAsset {
  id: string;
  symbol: string;
  name: string;
  nameKo: string;
  category: AssetCategory;
  price: number;
  volume: number;
  dollarVolume: number;
  weight: number;
  change24h: number;
  /** Estimated $ flow ≈ dollarVolume * change%  */
  flowEstimate: number;
  marketCap: number | null;
  highlight?: boolean;
}

export interface SemiconductorSignal {
  kind: SignalKind;
  label: string;
  summary: string;
  smhWeight: number;
  smhWeightDeltaProxy: number;
  netFlowEstimate: number;
  relativeVolumeRatio: number;
  riskVolumeChangeAvg: number;
}

export interface CapitalFlowPayload {
  source: string;
  fetchedAt: string;
  totalDollarVolume: number;
  assets: CapitalAsset[];
  signal: SemiconductorSignal;
}
