import type { GenomeSelection } from "@/types/genome"

function wrapSequence(sequence: string, width = 80): string {
  const lines: string[] = []
  for (let index = 0; index < sequence.length; index += width) {
    lines.push(sequence.slice(index, index + width))
  }
  return lines.join("\n")
}

export async function genomeToFasta(
  genome: GenomeSelection
): Promise<string> {
  if (genome.source === "local") {
    return genome.file.text()
  }

  return `>${genome.header}\n${wrapSequence(genome.sequence)}\n`
}
