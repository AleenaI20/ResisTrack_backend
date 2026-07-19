import { useState } from "react"
import { ArrowRight, Database, FileUp } from "lucide-react"

import { CohortList } from "@/components/dashboard/cohort-list"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { FastaUploadPanel } from "@/components/dashboard/fasta-upload-panel"
import { NcbiGenomeSearch } from "@/components/dashboard/ncbi-genome-search"
import { Button } from "@/components/ui/button"
import {
  createGenomeId,
  genomeIdentityKey,
} from "@/lib/genome-label"
import { cn } from "@/lib/utils"
import type { CohortGenome, GenomeSelection } from "@/types/genome"
import { MAX_COHORT_SIZE, MIN_COHORT_SIZE } from "@/types/genome"

type DashboardPageProps = {
  cohort: CohortGenome[]
  onCohortChange: (cohort: CohortGenome[]) => void
  onContinue: () => void
}

export function DashboardPage({
  cohort,
  onCohortChange,
  onContinue,
}: DashboardPageProps) {
  const [source, setSource] = useState<"ncbi" | "local">("ncbi")
  const canContinue = cohort.length >= MIN_COHORT_SIZE

  function addGenome(genome: GenomeSelection) {
    const identity = genomeIdentityKey(genome)
    if (cohort.some((entry) => genomeIdentityKey(entry.genome) === identity)) {
      return
    }
    if (cohort.length >= MAX_COHORT_SIZE) {
      return
    }

    const id = createGenomeId(
      genome,
      cohort.map((entry) => entry.id)
    )
    onCohortChange([
      ...cohort,
      {
        id,
        genome,
        isPrimary: cohort.length === 0,
      },
    ])
  }

  function removeGenome(id: string) {
    const remaining = cohort.filter((entry) => entry.id !== id)
    if (remaining.length === 0) {
      onCohortChange([])
      return
    }
    if (!remaining.some((entry) => entry.isPrimary)) {
      remaining[0] = { ...remaining[0], isPrimary: true }
    }
    onCohortChange(remaining)
  }

  function setPrimary(id: string) {
    onCohortChange(
      cohort.map((entry) => ({
        ...entry,
        isPrimary: entry.id === id,
      }))
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-5 md:p-8 lg:pt-10">
      <DashboardHeader />

      <div
        className="inline-flex w-fit rounded-md border border-border bg-muted/50 p-1"
        role="group"
        aria-label="Genome source"
      >
        <Button
          type="button"
          size="sm"
          variant={source === "ncbi" ? "secondary" : "ghost"}
          onClick={() => setSource("ncbi")}
          className={cn(
            "rounded-[4px]",
            source === "ncbi" && "bg-background shadow-sm"
          )}
        >
          <Database />
          Search NCBI
        </Button>
        <Button
          type="button"
          size="sm"
          variant={source === "local" ? "secondary" : "ghost"}
          onClick={() => setSource("local")}
          className={cn(
            "rounded-[4px]",
            source === "local" && "bg-background shadow-sm"
          )}
        >
          <FileUp />
          Upload FASTA
        </Button>
      </div>

      {source === "ncbi" ? (
        <NcbiGenomeSearch cohort={cohort} onAddGenome={addGenome} />
      ) : (
        <FastaUploadPanel cohort={cohort} onAddGenome={addGenome} />
      )}

      <CohortList
        cohort={cohort}
        onRemove={removeGenome}
        onSetPrimary={setPrimary}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {canContinue
            ? `${cohort.length} genomes ready for analysis.`
            : `Add at least ${MIN_COHORT_SIZE} genomes to continue.`}
        </p>
        <Button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded-md"
        >
          Next
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
