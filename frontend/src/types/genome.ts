export type NcbiGenomeSummary = {
  uid: string
  accession: string
  title: string
  length: number
  updated_at: string | null
}

export type NcbiGenomeSequence = {
  source: "ncbi"
  uid: string
  accession: string
  header: string
  sequence: string
  length: number
  organism?: string
}

export type GenomeSelection =
  | {
      source: "local"
      file: File
    }
  | NcbiGenomeSequence

export type CohortGenome = {
  id: string
  genome: GenomeSelection
  isPrimary: boolean
}

export const MIN_COHORT_SIZE = 2
export const MAX_COHORT_SIZE = 10
