export type AmrFinderAnalysis = {
  schema_version: string
  success: boolean
  service: "amrfinderplus"
  organism: string | null
  predicted_protein_count: number
  finding_count: number
  findings: Array<Record<string, string>>
  detected_features: Record<string, boolean>
  raw_output: string
}
