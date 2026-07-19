import { Dna, Star, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getGenomeDetail, getGenomeLabel } from "@/lib/genome-label"
import type { CohortGenome } from "@/types/genome"
import { MAX_COHORT_SIZE, MIN_COHORT_SIZE } from "@/types/genome"

type CohortListProps = {
  cohort: CohortGenome[]
  onRemove: (id: string) => void
  onSetPrimary: (id: string) => void
}

export function CohortList({
  cohort,
  onRemove,
  onSetPrimary,
}: CohortListProps) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>Genome cohort</CardTitle>
        <CardDescription>
          Select {MIN_COHORT_SIZE}–{MAX_COHORT_SIZE} genomes. The primary genome
          is analyzed with AMRFinderPlus; the full cohort builds the tree.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {cohort.length} of {MAX_COHORT_SIZE} genomes selected
        </p>

        {cohort.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            Add genomes from NCBI search or local FASTA upload.
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {cohort.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Dna
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {getGenomeLabel(entry.genome)}
                      </p>
                      {entry.isPrimary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getGenomeDetail(entry.genome)} · {entry.id}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!entry.isPrimary ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md"
                      onClick={() => onSetPrimary(entry.id)}
                    >
                      <Star aria-hidden="true" />
                      Set primary
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-md"
                    onClick={() => onRemove(entry.id)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
