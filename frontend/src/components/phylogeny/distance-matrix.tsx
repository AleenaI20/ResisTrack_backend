import type { PhylogenyBuildResponse } from "@/types/phylogeny"

type DistanceMatrixProps = {
  result: PhylogenyBuildResponse
  selectedGenomeId: string | null
  onSelectGenome: (genomeId: string) => void
}

function formatDistance(value: number): string {
  if (value === 0) {
    return "0"
  }
  return value.toFixed(3)
}

export function DistanceMatrix({
  result,
  selectedGenomeId,
  onSelectGenome,
}: DistanceMatrixProps) {
  const ids = result.distance_matrix.map((row) => row.genome_id)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full border-collapse text-left text-xs">
        <caption className="sr-only">
          Pairwise Jaccard distances between genomes
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="px-3 py-2 font-medium">
              Genome
            </th>
            {ids.map((id) => (
              <th
                key={id}
                scope="col"
                className="px-3 py-2 font-medium whitespace-nowrap"
              >
                <button
                  type="button"
                  className={
                    selectedGenomeId === id
                      ? "text-primary underline-offset-2 hover:underline"
                      : "hover:underline"
                  }
                  onClick={() => onSelectGenome(id)}
                >
                  {id}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.distance_matrix.map((row) => (
            <tr
              key={row.genome_id}
              className={
                selectedGenomeId === row.genome_id
                  ? "bg-accent/40"
                  : "border-b border-border/70"
              }
            >
              <th
                scope="row"
                className="px-3 py-2 font-medium whitespace-nowrap"
              >
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => onSelectGenome(row.genome_id)}
                >
                  {row.genome_id}
                </button>
              </th>
              {ids.map((columnId) => (
                <td
                  key={`${row.genome_id}-${columnId}`}
                  className="px-3 py-2 tabular-nums text-muted-foreground"
                >
                  {formatDistance(row.distances[columnId] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
