export type PredictionCall =
  | "likely_to_fail"
  | "likely_to_work"
  | "no_call"

export type EvidenceCategory =
  | "known_resistance_marker"
  | "statistical_association"
  | "no_known_signal"

export type TargetGateStatus =
  | "not_required_for_fail_call"
  | "not_confirmed"
  | "not_evaluated"

export type AntibioticPrediction = {
  drug: string
  call: PredictionCall
  confidence: number
  resistance_probability: number
  evidence_category: EvidenceCategory
  supporting_features: string[]
  model_tier: string
  no_call_margin: number
  target_gate_status: TargetGateStatus
  call_reason: string
}

export type PredictionReport = {
  schema_version: string
  organism: string | null
  supported_species: string
  predictions: AntibioticPrediction[]
  matched_features: string[]
  unmatched_features: string[]
  disclaimer: string
}

export type PredictionMeta = {
  schema_version: string
  supported_species: string
  drugs: string[]
  gene_columns: string[]
  demo_markers: string[]
}
