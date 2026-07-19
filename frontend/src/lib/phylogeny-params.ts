import type { PhylogenyBuildRequest } from "@/types/phylogeny"

function sequenceLengthFromFasta(fasta: string): number {
  return fasta
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("")
    .replace(/\s+/g, "").length
}

export function choosePhylogenyParameters(
  genomes: Array<{ fasta: string }>
): Pick<PhylogenyBuildRequest, "kmer_size" | "scaled"> {
  const lengths = genomes.map((genome) => sequenceLengthFromFasta(genome.fasta))
  const minLength = Math.min(...lengths)

  if (minLength < 5_000) {
    return { kmer_size: 15, scaled: 1 }
  }
  if (minLength < 50_000) {
    return { kmer_size: 21, scaled: 100 }
  }
  return { kmer_size: 21, scaled: 1000 }
}
