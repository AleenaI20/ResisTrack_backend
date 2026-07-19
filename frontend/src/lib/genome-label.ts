import type { CohortGenome, GenomeSelection } from "@/types/genome"
import { formatFileSize } from "@/lib/format"

const baseCountFormatter = new Intl.NumberFormat("en-US")
const SAFE_ID = /[^A-Za-z0-9_.:-]+/g

export function getGenomeLabel(genome: GenomeSelection): string {
  if (genome.source === "local") {
    return genome.file.name
  }
  return genome.accession
}

export function getGenomeDetail(genome: GenomeSelection): string {
  if (genome.source === "local") {
    return formatFileSize(genome.file.size)
  }
  return `${baseCountFormatter.format(genome.length)} bp · NCBI`
}

export function sanitizeGenomeId(raw: string): string {
  const cleaned = raw.replace(SAFE_ID, "_").replace(/^_+|_+$/g, "")
  return cleaned.slice(0, 120) || "genome"
}

export function createGenomeId(
  genome: GenomeSelection,
  existingIds: Iterable<string>
): string {
  const occupied = new Set(existingIds)
  const base =
    genome.source === "ncbi"
      ? sanitizeGenomeId(genome.accession)
      : sanitizeGenomeId(genome.file.name.replace(/\.[^.]+$/, ""))

  if (!occupied.has(base)) {
    return base
  }

  let suffix = 2
  while (occupied.has(`${base}_${suffix}`)) {
    suffix += 1
  }
  return `${base}_${suffix}`
}

export function getPrimaryGenome(
  cohort: CohortGenome[]
): CohortGenome | null {
  return cohort.find((entry) => entry.isPrimary) ?? cohort[0] ?? null
}

export function genomeIdentityKey(genome: GenomeSelection): string {
  if (genome.source === "ncbi") {
    return `ncbi:${genome.uid}`
  }
  return `local:${genome.file.name}:${genome.file.size}:${genome.file.lastModified}`
}
